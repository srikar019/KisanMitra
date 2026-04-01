import React from 'react';

/**
 * Allowlist of safe HTML tags and attributes for translation strings.
 * Only these elements can appear in translated content.
 */
const ALLOWED_TAGS = new Set(['strong', 'em', 'b', 'i', 'br', 'span', 'a']);
const ALLOWED_ATTRS = new Set(['class', 'className', 'href', 'target', 'rel']);

/**
 * Sanitizes an HTML string by stripping all tags and attributes not in the allowlist.
 * This prevents XSS while allowing basic formatting in translation strings.
 */
function sanitizeHTML(html: string): string {
  // Replace disallowed tags but keep allowed ones
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return ''; // Strip disallowed tags entirely
    }

    // For closing tags, just return the clean closing tag
    if (match.startsWith('</')) {
      return `</${tag}>`;
    }

    // For opening tags, filter attributes
    const attrRegex = /([a-zA-Z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    const safeAttrs: string[] = [];
    let attrMatch;
    while ((attrMatch = attrRegex.exec(match)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? '';
      if (ALLOWED_ATTRS.has(attrName)) {
        // Prevent javascript: URLs in href
        if (attrName === 'href' && attrValue.toLowerCase().trim().startsWith('javascript:')) {
          continue;
        }
        safeAttrs.push(`${attrName}="${attrValue}"`);
      }
    }

    const isSelfClosing = match.endsWith('/>') || tag === 'br';
    const attrStr = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
    return isSelfClosing ? `<${tag}${attrStr} />` : `<${tag}${attrStr}>`;
  });
}

interface SafeHTMLProps {
  /** The HTML string from translations to render safely */
  html: string;
  /** The wrapper element type. Defaults to 'span'. */
  as?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * SafeHTML renders translated strings that contain HTML markup
 * (like <strong>, <em>) while sanitizing against XSS.
 *
 * Usage:
 *   <SafeHTML html={translate('some.key', { name: 'John' })} />
 *   <SafeHTML html={translate('some.key')} as="p" className="text-sm" />
 */
const SafeHTML: React.FC<SafeHTMLProps> = ({ html, as: tag = 'span', className }) => {
  const sanitized = sanitizeHTML(html);
  return React.createElement(tag, {
    className,
    dangerouslySetInnerHTML: { __html: sanitized },
  });
};

export default SafeHTML;
