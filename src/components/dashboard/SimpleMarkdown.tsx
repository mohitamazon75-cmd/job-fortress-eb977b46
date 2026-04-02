import React from 'react';

interface SimpleMarkdownProps {
  content: string;
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      nodes.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      nodes.push(<code key={key++} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{match[4]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: React.ReactNode[][] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.type === 'ul' ? 'ul' : 'ol';
    const cls = listBuffer.type === 'ul' ? 'list-disc' : 'list-decimal';
    elements.push(
      <Tag key={key++} className={`${cls} pl-5 my-1 space-y-0.5 text-sm`}>
        {listBuffer.items.map((item, i) => <li key={i}>{item}</li>)}
      </Tag>
    );
    listBuffer = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={key++} className="font-semibold text-sm mt-2 mb-1">{parseInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={key++} className="font-semibold text-base mt-2 mb-1">{parseInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={key++} className="font-bold text-base mt-2 mb-1">{parseInline(trimmed.slice(2))}</h2>);
    }
    // Bullet lists
    else if (/^[-•]\s/.test(trimmed)) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(parseInline(trimmed.slice(2)));
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(parseInline(trimmed.replace(/^\d+\.\s/, '')));
    }
    // Empty line
    else if (trimmed === '') {
      flushList();
    }
    // Paragraph
    else {
      flushList();
      elements.push(<p key={key++} className="text-sm my-0.5">{parseInline(trimmed)}</p>);
    }
  }

  flushList();

  return <div className="space-y-0.5">{elements}</div>;
};
