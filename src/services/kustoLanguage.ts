import type { HLJSApi, Language } from "highlight.js";

/**
 * Kusto Query Language (Azure Monitor, Application Insights, Log Analytics),
 * which highlight.js doesn't ship. Enough to color a course's queries: the
 * tabular operators, common functions, strings, numbers with time units,
 * comments and the pipes between steps.
 */
export function kusto(hljs: HLJSApi): Language {
  return {
    name: "Kusto (KQL)",
    aliases: ["kql"],
    // operators like project-away and mv-expand are one word
    keywords: {
      $pattern: /[A-Za-z_][\w]*(?:-[A-Za-z]+)*/,
      keyword:
        "where project project-away project-keep project-rename project-reorder extend " +
        "summarize by order sort asc desc nulls first last take limit top join on kind " +
        "inner leftouter rightouter fullouter leftanti rightanti leftsemi rightsemi union " +
        "let render as distinct mv-expand mv-apply parse parse-where evaluate " +
        "datatable range print search find getschema lookup make-series materialize " +
        "invoke serialize sample sample-distinct with step from to and or not in " +
        "has has_any has_all contains startswith endswith " +
        "matches regex between",
      literal: "true false null dynamic",
      built_in:
        "ago now bin floor ceiling datetime timespan todatetime totimespan tostring toint " +
        "tolong todouble toreal tobool todynamic strcat strcat_array split parse_json " +
        "iff iif case isempty isnotempty isnull isnotnull count countif dcount dcountif " +
        "avg avgif sum sumif min max minif maxif stdev variance percentile percentiles " +
        "make_list make_set make_bag arg_max arg_min any take_any startofday endofday " +
        "startofweek startofmonth format_datetime format_timespan extract extract_all " +
        "replace_string replace_regex trim tolower toupper strlen substring indexof " +
        "coalesce pack bag_pack row_number prev next round abs log exp pow sqrt hash",
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.APOS_STRING_MODE,
      {
        scope: "number",
        match: /\b\d+(?:\.\d+)?(?:ms|microseconds?|ticks?|[smhd])?\b/,
        relevance: 0,
      },
      { scope: "operator", match: /\|/, relevance: 0 },
    ],
  };
}
