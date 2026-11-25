import { describe, it, expect } from 'vitest';
import { markdownToHtmlNoImages, markdownToHTMLSafe } from './htmlMarkdownUtils';
import { LocalCourseSettings } from '@/features/local/course/localCourseSettings';

describe('markdownToHtmlNoImages', () => {
  it('moves caption into table when caption immediately precedes table', () => {
    const markdown = `<caption>My Table</caption>

| Header |
| --- |
| Cell |`;
    const html = markdownToHtmlNoImages(markdown);
    // We expect the caption to be inside the table
    expect(html).toMatch(/<table>\s*<caption>My Table<\/caption>/);
  });

  it('renders table correctly without caption', () => {
    const markdown = `
| Header |
| --- |
| Cell |`;
    const html = markdownToHtmlNoImages(markdown);
    expect(html).toMatch(/<table>/);
    expect(html).not.toMatch(/<caption>/);
    expect(html).toContain('Header');
    expect(html).toContain('Cell');
  });

  it('moves caption with attributes into table', () => {
    const markdown = `<caption style="color:red">My Table</caption>

| Header |
| --- |
| Cell |`;
    const html = markdownToHtmlNoImages(markdown);
    expect(html).toMatch(/<table>\s*<caption style="color:red">My Table<\/caption>/);
  });

  it('adds scope="col" to table headers', () => {
    const markdown = `
| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`;
    const html = markdownToHtmlNoImages(markdown);
    expect(html).toContain('<th scope="col">Header 1</th>');
    expect(html).toContain('<th scope="col">Header 2</th>');
  });

  it('does not add an extra empty header row', () => {
    const markdown = `
| Header |
| --- |
| Cell |`;
    const html = markdownToHtmlNoImages(markdown);
    expect(html).not.toContain('<th scope="col"></th>');
    const thCount = (html.match(/<th scope="col"/g) || []).length;
    expect(thCount).toBe(1);
  });

  it('does not add scope="col" to raw HTML tables', () => {
    const markdown = `
<table>
  <thead>
    <tr>
      <th>Raw Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Raw Cell</td>
    </tr>
  </tbody>
</table>

| MD Header |
| --- |
| MD Cell |`;
    const html = markdownToHtmlNoImages(markdown);
    
    // Raw table should be untouched (or at least not have scope="col" added if it wasn't there)
    expect(html).toContain('<th>Raw Header</th>');
    expect(html).not.toContain('<th scope="col">Raw Header</th>');

    // Markdown table should have scope="col"
    expect(html).toContain('<th scope="col">MD Header</th>');
  });

  it("can recognize latex with $ delims", () => {
    const rawMarkdown = `
This is latex: $x_2$
    endline`;

    const doc = markdownToHtmlNoImages(rawMarkdown);
    expect(doc).not.toContain("$");
    expect(doc).toContain("<mi>x</mi>");
    expect(doc).not.toContain("x_2");
  });

  it("can recognize latex with $ delims and no surrounding space", () => {
    const rawMarkdown = `
This is latex: ($x_2$)
    endline`;

    const doc = markdownToHtmlNoImages(rawMarkdown);
    expect(doc).not.toContain("$");
    expect(doc).toContain("<mi>x</mi>");
    expect(doc).not.toContain("x_2");
  });

  it("can recognize latex with $$ delims and no surrounding space", () => {
    const rawMarkdown = `
This is latex: ($$x_2$$)
    endline`;

    const doc = markdownToHtmlNoImages(rawMarkdown);
    expect(doc).not.toContain("$");
    expect(doc).toContain("<mi>x</mi>");
    expect(doc).not.toContain("x_2");
  });

});

describe('a link to a file beside the markdown, rendered for Canvas', () => {
  const settings = { canvasId: 42, assets: [{ sourceUrl: 'Week 1/files/kkoans.html', canvasUrl: 'https://canvas/courses/42/files/7/download' }] } as LocalCourseSettings;
  it('points at the file\'s uploaded copy, keeping the place in it', () => {
    expect(markdownToHTMLSafe({ markdownString: '[koans](../files/kkoans.html#level-2)', settings })).toContain('href="https://canvas/courses/42/files/7/download#level-2"');
  });
  it('stays as written for a file not uploaded yet', () => {
    expect(markdownToHTMLSafe({ markdownString: '[demo](demo.html)', settings })).toContain('href="demo.html"');
  });
  it('points where a preview says instead: at the local file', () => {
    expect(markdownToHTMLSafe({ markdownString: '[koans](../files/kkoans.html)', settings, fileHref: (link) => `/local/${link}` })).toContain('href="/local/files/kkoans.html"');
  });
});
