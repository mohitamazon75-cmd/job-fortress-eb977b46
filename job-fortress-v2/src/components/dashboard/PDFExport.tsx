import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { ScanReport, normalizeTools } from '@/lib/scan-engine';
import { computeStabilityScore } from '@/lib/stability-score';
import { inferSeniorityTier } from '@/lib/seniority-utils';

interface PDFExportProps {
  report: ScanReport;
  compact?: boolean;
}

export default function PDFExport({ report, compact = false }: PDFExportProps) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');

      // Build an off-screen styled div for PDF content
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;padding:48px;background:#fff;color:#111;font-family:system-ui,-apple-system,sans-serif;';

      const roleName = report.role || report.industry || 'Professional';
      const score = computeStabilityScore(report);
      const seniorityTier = inferSeniorityTier(report.seniority_tier);
      const skills = report.score_breakdown?.skill_adjustments || [];
      const tools = normalizeTools(report.ai_tools_replacing || []);
      const moats = report.moat_skills || [];
      const highRisk = skills.filter(s => s.automation_risk >= 60);
      const safeSkills = skills.filter(s => s.automation_risk < 30);

      container.innerHTML = `
        <div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;">
          <h1 style="font-size:28px;font-weight:900;margin:0;">AI Career Intelligence Report</h1>
          <p style="color:#666;font-size:13px;margin:4px 0 0;">Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div style="display:flex;gap:24px;margin-bottom:28px;">
          <div style="flex:1;background:#f8fafc;border-radius:12px;padding:20px;border:1px solid #e2e8f0;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:700;margin:0 0 4px;">Role</p>
            <p style="font-size:20px;font-weight:800;margin:0;">${roleName}</p>
          </div>
          <div style="flex:1;background:#f8fafc;border-radius:12px;padding:20px;border:1px solid #e2e8f0;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:700;margin:0 0 4px;">Career Position Score</p>
            <p style="font-size:36px;font-weight:900;margin:0;color:${score >= 60 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'};">${score}<span style="font-size:18px;color:#94a3b8;">/100</span></p>
          </div>
          <div style="flex:1;background:#f8fafc;border-radius:12px;padding:20px;border:1px solid #e2e8f0;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-weight:700;margin:0 0 4px;">Industry</p>
            <p style="font-size:20px;font-weight:800;margin:0;">${report.industry || 'N/A'}</p>
          </div>
        </div>

        ${skills.length > 0 ? `
        <div style="margin-bottom:28px;">
          <h2 style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;color:#334155;">Skill Risk Analysis</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:2px solid #e2e8f0;">
                <th style="text-align:left;padding:8px 12px;font-weight:700;color:#64748b;">Skill</th>
                <th style="text-align:center;padding:8px 12px;font-weight:700;color:#64748b;">Risk %</th>
                <th style="text-align:left;padding:8px 12px;font-weight:700;color:#64748b;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${skills.slice(0, 10).map(s => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:8px 12px;font-weight:600;">${s.skill_name}</td>
                  <td style="text-align:center;padding:8px 12px;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:99px;font-weight:700;font-size:12px;background:${s.automation_risk >= 60 ? '#fef2f2' : s.automation_risk >= 30 ? '#fffbeb' : '#f0fdf4'};color:${s.automation_risk >= 60 ? '#dc2626' : s.automation_risk >= 30 ? '#d97706' : '#16a34a'};">
                      ${s.automation_risk}%
                    </span>
                  </td>
                  <td style="padding:8px 12px;color:#64748b;">${s.automation_risk >= 60 ? '⚠️ High Risk' : s.automation_risk >= 30 ? '⚡ Moderate' : '✅ Safe'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${moats.length > 0 ? `
        <div style="margin-bottom:28px;">
          <h2 style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;color:#334155;">Your Moat Skills (AI-Resistant)</h2>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${moats.map(m => `<span style="background:#f0fdf4;color:#16a34a;padding:6px 14px;border-radius:99px;font-size:13px;font-weight:600;border:1px solid #bbf7d0;">${m}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        ${tools.length > 0 ? `
        <div style="margin-bottom:28px;">
          <h2 style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;color:#334155;">AI Tools Threatening Your Role</h2>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${tools.slice(0, 8).map(t => `<span style="background:#fef2f2;color:#dc2626;padding:6px 14px;border-radius:99px;font-size:13px;font-weight:600;border:1px solid #fecaca;">${typeof t === 'string' ? t : (t as any).tool_name || String(t)}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        ${report.judo_strategy ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:28px;">
          <h2 style="font-size:16px;font-weight:800;margin:0 0 8px;color:#1e40af;">🥋 Judo Strategy</h2>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">
            <strong>Learn ${report.judo_strategy.recommended_tool}</strong> — ${report.judo_strategy.pitch || 'Turn the AI threat into your competitive advantage'}
          </p>
        </div>
        ` : ''}

        <div style="border-top:2px solid #e2e8f0;padding-top:16px;margin-top:32px;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">
            📊 Computed deterministically · Same input = same output · ${skills.length} skills analyzed · ${tools.length} AI tools checked
          </p>
          <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">
            Generated by JobBachao — AI Career Intelligence · jobbachao.com
          </p>
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      document.body.removeChild(container);

      // Convert to PDF-like image download (A4-ish proportions)
      const link = document.createElement('a');
      link.download = `career-report-${roleName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      link.click();
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={generatePDF}
        disabled={generating}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground disabled:opacity-50"
      >
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {generating ? 'Generating...' : 'Download Report'}
      </button>
    );
  }

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-all text-sm font-medium text-foreground disabled:opacity-50"
    >
      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {generating ? 'Generating Report...' : 'Download Full Report'}
    </button>
  );
}
