import React from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {colors, radii, typography} from '../theme/colors';

type MarkdownTextProps = {
  content: string;
  tone?: 'light' | 'dark';
  tailPlaceholderChars?: number;
  compact?: boolean;
};

type MarkdownBlock =
  | {type: 'paragraph'; text: string}
  | {type: 'code'; text: string};

const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|https?:\/\/[^\s]+)/g;

export function MarkdownText({
  content,
  tone = 'dark',
  tailPlaceholderChars = 0,
  compact = false,
}: MarkdownTextProps): React.JSX.Element {
  const blocks = splitBlocks(content);
  const lastParagraphIndex = findLastParagraphIndex(blocks);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') {
          return (
            <View
              key={`code_${blockIndex}`}
              style={[
                styles.codeBlock,
                compact && styles.codeBlockCompact,
                tone === 'light' ? styles.codeBlockLight : styles.codeBlockDark,
              ]}>
              <Text
                style={[
                  styles.codeText,
                  compact && styles.codeTextCompact,
                  tone === 'light' ? styles.lightText : styles.darkText,
                ]}>
                {block.text}
              </Text>
            </View>
          );
        }

        const lines = block.text.split('\n');
        const isLastParagraph = blockIndex === lastParagraphIndex;

        return (
          <Text
            key={`paragraph_${blockIndex}`}
            style={[
              styles.paragraph,
              compact && styles.paragraphCompact,
              tone === 'light' ? styles.lightText : styles.darkText,
            ]}>
            {lines.map((line, lineIndex) => {
              const isLastLine = lineIndex === lines.length - 1;
              return (
                <React.Fragment key={`line_${blockIndex}_${lineIndex}`}>
                  {renderInlineTokens(line, tone, compact)}
                  {isLastParagraph && isLastLine && tailPlaceholderChars > 0 ? (
                    <Text style={styles.inlineTailSpacer}>
                      {Array.from({length: tailPlaceholderChars}, () => '\u00A0').join('')}
                    </Text>
                  ) : null}
                  {lineIndex < lines.length - 1 ? '\n' : null}
                </React.Fragment>
              );
            })}
          </Text>
        );
      })}
    </View>
  );
}

function splitBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const codeRegex = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(content)) !== null) {
    const leading = content.slice(lastIndex, match.index);
    if (leading) {
      blocks.push({type: 'paragraph', text: leading});
    }

    blocks.push({
      type: 'code',
      text: match[1].replace(/^\n+|\n+$/g, ''),
    });
    lastIndex = match.index + match[0].length;
  }

  const trailing = content.slice(lastIndex);
  if (trailing) {
    blocks.push({type: 'paragraph', text: trailing});
  }

  return blocks.length > 0 ? blocks : [{type: 'paragraph', text: content}];
}

function findLastParagraphIndex(blocks: MarkdownBlock[]): number {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type === 'paragraph') {
      return index;
    }
  }

  return -1;
}

function renderInlineTokens(
  line: string,
  tone: 'light' | 'dark',
  compact: boolean,
): Array<string | React.JSX.Element> {
  INLINE_TOKEN.lastIndex = 0;
  const nodes: Array<string | React.JSX.Element> = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_TOKEN.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const raw = match[0];

    if (raw.startsWith('**') && raw.endsWith('**')) {
      nodes.push(
        <Text
          key={`bold_${tokenIndex}`}
          style={[
            styles.bold,
            tone === 'light' ? styles.lightText : styles.darkText,
          ]}>
          {raw.slice(2, -2)}
        </Text>,
      );
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      nodes.push(
        <Text
          key={`inline_code_${tokenIndex}`}
          style={[
            styles.inlineCode,
            compact && styles.inlineCodeCompact,
            tone === 'light' ? styles.inlineCodeLight : styles.inlineCodeDark,
          ]}>
          {raw.slice(1, -1)}
        </Text>,
      );
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      nodes.push(
        <Text
          key={`italic_${tokenIndex}`}
          style={[
            styles.italic,
            tone === 'light' ? styles.lightText : styles.darkText,
          ]}>
          {raw.slice(1, -1)}
        </Text>,
      );
    } else {
      nodes.push(
        <Text
          key={`link_${tokenIndex}`}
          style={[
            styles.link,
            tone === 'light' ? styles.lightLink : styles.darkLink,
          ]}
          onPress={() => {
            Linking.openURL(raw).catch(() => undefined);
          }}>
          {raw}
        </Text>,
      );
    }

    lastIndex = match.index + raw.length;
    tokenIndex += 1;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  containerCompact: {
    gap: 6,
  },
  paragraph: {
    fontFamily: typography.serif,
    fontSize: 14,
    lineHeight: 21,
  },
  paragraphCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  darkText: {
    color: colors.ink,
  },
  lightText: {
    color: colors.white,
  },
  bold: {
    fontFamily: typography.serifSemiBold,
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    borderRadius: 4,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontFamily: 'Courier',
    fontSize: 12,
  },
  inlineCodeCompact: {
    fontSize: 11,
  },
  inlineCodeDark: {
    color: colors.ink,
    backgroundColor: 'rgba(42, 35, 32, 0.08)',
  },
  inlineCodeLight: {
    color: colors.white,
    backgroundColor: 'rgba(255, 250, 242, 0.16)',
  },
  link: {
    textDecorationLine: 'underline',
  },
  darkLink: {
    color: colors.terracottaDark,
  },
  lightLink: {
    color: 'rgba(255, 250, 242, 0.92)',
  },
  codeBlock: {
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  codeBlockCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  codeBlockDark: {
    backgroundColor: 'rgba(42, 35, 32, 0.08)',
  },
  codeBlockLight: {
    backgroundColor: 'rgba(255, 250, 242, 0.14)',
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
  },
  codeTextCompact: {
    fontSize: 11,
    lineHeight: 16,
  },
  inlineTailSpacer: {
    color: 'transparent',
  },
});
