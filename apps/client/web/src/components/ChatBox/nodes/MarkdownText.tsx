'use client';

/**
 * Renders a text chat node as markdown with citation support, so assistant prose
 * displays formatted (lists, links, emphasis) and inline source references
 * remain clickable within the conversation.
 */
import type { ChatNodeOfType, Citation } from '@repo/types';
import ReactMarkdown from 'react-markdown';

import styles from './MarkdownText.module.scss';

interface MarkdownTextProps {
  node: ChatNodeOfType<'text'>;
}

function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <footer className={styles.citations}>
      <span className={styles.citationsLabel}>Sources</span>
      <ul className={styles.citationList}>
        {citations.map((citation) => (
          <li key={citation.id} className={styles.citationItem}>
            {citation.url ? (
              <a
                href={citation.url}
                target='_blank'
                rel='noopener noreferrer'
                className={styles.citationLink}
              >
                {citation.label}
              </a>
            ) : (
              <span className={styles.citationText}>{citation.label}</span>
            )}
          </li>
        ))}
      </ul>
    </footer>
  );
}

export function MarkdownText({ node }: MarkdownTextProps) {
  const citations = node.citations ?? [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.prose}>
        <ReactMarkdown>{node.content}</ReactMarkdown>
      </div>
      {citations.length > 0 && <CitationList citations={citations} />}
    </div>
  );
}
