import { describe, expect, it } from "vitest";
import { carriesOn, comingBack, dragEdge, gainsFromAsked, Effect, fit, fitAsked, growOrShrink, roomOf, rowAsked, windowGain, Layout, LetGo, makeRoom, openPanes, pushEdge, resize, restore, Row, Slab } from "./cascade";

// modules, calendar, editor and preview open, 500 wide, each 100 past its narrowest; bars 20 wide, no gaps
const row: Layout = {
  slabs: ["modules", "calendar", "editor", "preview"].map((id) => ({ id, width: 500, minWidth: 400, maxWidth: Infinity, collapsed: false, hidden: false })),
  lead: 0,
  free: 0,
  bar: 20,
  gap: 0,
  least: 20,
};
/** `from` (the row unless given) with some panes changed, and anything else. */
const edit = (panes: Record<string, Partial<Slab>>, rest: Partial<Layout> = {}, from = row): Layout => ({ ...from, ...rest, slabs: from.slabs.map((s) => ({ ...s, ...panes[s.id] })) });
/** A row in one line: a pane's width, `_` collapsed, `-` off the page. */
const look = (l: Layout) => l.slabs.map((s) => s.id + (s.hidden ? "-" : s.collapsed ? "_" : s.width)).join(" ");
const kinds = (effects: Effect[]) => effects.map((e) => `${e.kind} ${e.id}`);
const narrowed = (id: string, width: number): Effect => ({ id, kind: "narrow", width });
const all = 300 + 380 * 3 + 60; // everything after the calendar's bar can give
/** One test per rule: its name, what the code gives, what the rule says. */
const rules = (cases: [string, () => unknown, unknown][]) => it.each(cases)("%s", (_, actual, expected) => expect(actual()).toEqual(expected));

describe("an edge pushed (the calendar's bar dragged right)", () => {
  const at = (d: number, l = row) => pushEdge(l, 1, d);
  rules([
    ["takes the empty room at the end it moves toward first", () => at(80, { ...row, free: 100 }).layout.free, 20],
    ["then narrows the panes it moves toward to their narrowest, nearest first", () => look(at(150).layout), "modules650 calendar400 editor450 preview500"],
    ["then collapses them, farthest first", () => look(at(300 + 380).layout), "modules1180 calendar400 editor400 preview_"],
    ["then takes their bars off the page, farthest first", () => look(at(300 + 380 * 3 + 20).layout), "modules1960 calendar_ editor_ preview-"],
    ["goes no further than what can give", () => at(5000).moved, all],
    ["moves by as little as half a pixel", () => look(at(0.5).layout), "modules500.5 calendar499.5 editor500 preview500"],
    ["remembers each effect in the order it happened", () => kinds(at(all).effects), ["narrow calendar", "narrow editor", "narrow preview", "collapse preview", "collapse editor", "collapse calendar", "hide preview", "hide editor", "hide calendar"]],
    ["passes over a pane already at its narrowest, remembering nothing of it", () => kinds(at(50, edit({ calendar: { width: 400 } })).effects), ["narrow editor"]],
    ["passes over panes already collapsed or off the page", () => kinds(at(5000, edit({ editor: { collapsed: true }, preview: { hidden: true } })).effects), ["narrow calendar", "collapse calendar", "hide editor", "hide calendar"]],
    ["frees a bar's gap too when the bar leaves the page", () => at(5000, { ...row, gap: 10 }).moved, all + 3 * 10],
    ["collapses a pane narrowed to the least an open pane may be there, before the next narrows", () => look(at(490, edit({ calendar: { minWidth: 20 } })).layout), "modules990 calendar_ editor490 preview500"],
    ["remembers such a collapse", () => kinds(at(480, edit({ calendar: { minWidth: 20 } })).effects), ["narrow calendar", "collapse calendar"]],
    ["keeps a pane a pixel wider than the least open", () => look(at(446.5, edit({ calendar: { minWidth: 53.5 } }, { least: 52.5 })).layout), "modules946.5 calendar53.5 editor500 preview500"],
    ["counts a pane within half a pixel of the least as narrowed to it", () => look(at(447, edit({ calendar: { minWidth: 53 } }, { least: 52.5 })).layout), "modules947 calendar_ editor500 preview500"],
    ["leaves what such a collapse frees past the least as empty room at that end", () => at(450, edit({ calendar: { minWidth: 50 } }, { least: 50 })).layout.free, 30],
    ["grows the panes it moves away from, nearest first, each to its widest", () => look(pushEdge(edit({ calendar: { maxWidth: 520 } }), 2, 50).layout), "modules530 calendar520 editor450 preview500"],
    ["leaves what they don't take as empty room at that end", () => at(50, edit({ modules: { maxWidth: 520 } })).layout.lead, 30],
    ["leaves a pane already wider than its widest as it is", () => look(at(50, edit({ modules: { width: 600, maxWidth: 520 } })).layout), "modules600 calendar450 editor500 preview500"],
  ]);
});

describe("an edge pushed left, the mirror", () => {
  rules([
    ["takes the empty room before the first pane first", () => look(pushEdge({ ...row, lead: 50 }, 3, -50).layout), "modules500 calendar500 editor500 preview550"],
    ["then narrows the panes before it, nearest first", () => look(pushEdge(row, 3, -150).layout), "modules500 calendar450 editor400 preview650"],
    ["goes no further than what can give, and says so", () => pushEdge(row, 1, -5000).moved, -500],
    ["from the right end, leaves empty room there", () => pushEdge(row, 4, -150).layout.free, 150],
  ]);
});

describe("what was displaced, brought back as room returns", () => {
  const pushed = pushEdge(row, 1, all);
  // the right end dragged back left: the modules narrow, and the room at the end goes to what was displaced
  const back = (room: number) => restore(edit({ modules: { width: 2000 - room } }, { free: room }, pushed.layout), pushed.effects);
  const editor = (rest: Partial<Slab>, layout: Partial<Layout>, effect: Effect) => look(restore(edit({ editor: rest }, layout), [effect]).layout);
  rules([
    ["brings the bars back first, last taken first", () => look(back(20).layout), "modules1980 calendar_ editor- preview-"],
    ["then reopens the panes at the width they had, last collapsed first", () => look(back(60 + 380).layout), "modules1560 calendar400 editor_ preview_"],
    ["reopens a pane only when its width fits", () => look(back(60 + 379).layout), "modules1561 calendar_ editor_ preview_"],
    ["reopens a pane at least at its narrowest", () => editor({ collapsed: true }, { free: 500 }, { id: "editor", kind: "collapse", width: 300 }), "modules500 calendar500 editor400 preview500"],
    ["then widens the narrowed panes, last narrowed first, as far as the room goes", () => look(back(60 + 380 * 3 + 50).layout), "modules750 calendar400 editor400 preview450"],
    ["keeps what is not yet undone", () => kinds(back(60).records), kinds(pushed.effects.slice(0, 6))],
    ["keeps a narrowing undone only partly", () => kinds(back(60 + 380 * 3 + 50).records), ["narrow calendar", "narrow editor", "narrow preview"]],
    ["brings back as little as a pixel", () => editor({ width: 400 }, { free: 1 }, narrowed("editor", 500)), "modules500 calendar500 editor401 preview500"],
    ["brings nothing back without room", () => editor({ width: 400 }, { free: -1 }, narrowed("editor", 500)), "modules500 calendar500 editor400 preview500"],
    ["needs room for a bar's gap too to bring the bar back", () => editor({ hidden: true }, { free: 25, gap: 10 }, { id: "editor", kind: "hide", width: 500 }), "modules500 calendar500 editor- preview500"],
    ["drops what no longer applies, a pane no longer there included", () => restore(row, [...pushed.effects, narrowed("gone", 600)]).records, []],
  ]);
});

describe("room made for panes", () => {
  rules([
    ["is taken from the side after them first", () => look(makeRoom(row, ["editor"], 100).layout), "modules500 calendar500 editor500 preview400"],
    ["then from the side before them", () => look(makeRoom(row, ["editor"], 600).layout), "modules500 calendar400 editor500 preview-"],
    ["is what there is when there isn't enough", () => makeRoom(row, ["editor"], 5000).got, 1500],
  ]);
});

describe("a pane resized (the narrowest box)", () => {
  const grown = resize(row, "editor", 300, []);
  rules([
    ["grows by the room made for it", () => look(resize(row, "editor", 100, []).layout), "modules500 calendar500 editor600 preview400"],
    ["shrunk, gives the room back to what its growing displaced", () => resize(grown.layout, "editor", -300, grown.records), { layout: row, records: [] }],
    ["shrunk with nothing displaced, leaves empty room", () => resize(row, "editor", -100, []).layout.free, 100],
  ]);
});

describe("panes opened", () => {
  const editor = (rest: Partial<Slab>, layout: Partial<Layout>, records: Effect[] = []) => openPanes(edit({ editor: rest }, layout), ["editor"], records)!;
  rules([
    ["open at the width they had, taking the room after them", () => editor({ collapsed: true }, { free: 480 }).layout, row],
    ["open at least at their narrowest", () => look(editor({ collapsed: true, width: 300 }, { free: 380 }).layout), "modules500 calendar500 editor400 preview500"],
    ["need room for a bar and a gap too when they were off the page", () => editor({ hidden: true }, { free: 510, gap: 10 }).layout.free, 0],
    ["remember what they displaced after what was already waiting", () => kinds(editor({ collapsed: true }, {}, [narrowed("modules", 600)]).records), ["narrow modules", "narrow preview", "collapse preview"]],
    ["change nothing when they are open already", () => openPanes(row, ["editor"], []), undefined],
  ]);
});

describe("the row fitted to the window", () => {
  const sized = () => true;
  const room = (free: number, gained: number) => fit(edit({ editor: { width: 400 } }, { free }), [narrowed("editor", 500)], sized, gained);
  rules([
    ["too wide: the first open pane keeps its width, the rest give way", () => look(fit({ ...row, free: -150 }, [], sized, 0)!.layout), "modules500 calendar400 editor450 preview500"],
    ["too wide: doesn't remember narrowing a pane never sized (its default fitting the window)", () => fit({ ...row, free: -150 }, [], (id) => id === "editor", 0)!.records, [narrowed("editor", 500)]],
    ["too wide: remembers collapsing a pane never sized", () => kinds(fit({ ...row, free: -900 }, [], () => false, 0)!.records), ["collapse preview", "collapse editor"]],
    ["brings back what was displaced into the room the window gained", () => room(100, 100), { layout: row, records: [] }],
    ["leaves empty room a drag left as it is", () => room(100, 0), undefined],
    ["brings back no more than the window gained, the rest of the empty room left as it is", () => room(100, 30)!.layout, edit({ editor: { width: 430 } }, { free: 70 })],
    ["forgets what no longer applies", () => fit(row, [narrowed("editor", 500)], sized, 0), { layout: row, records: [] }],
    ["changes nothing when it fits", () => fit(row, [], sized, 0), undefined],
    ["leaves a row a pixel too wide alone (rounding)", () => fit({ ...row, free: -1 }, [], sized, 0), undefined],
    ["leaves a row with every pane collapsed alone", () => fit(edit(Object.fromEntries(row.slabs.map((s) => [s.id, { collapsed: true }])), { free: -10 }), [], sized, 0), undefined],
  ]);
});

describe("a double-click on a pane's title", () => {
  const editor = (maxWidth: number) => growOrShrink(edit({ editor: { maxWidth } }), "editor", [])!;
  rules([
    ["grows the pane to its widest", () => look(editor(700).layout), "modules500 calendar500 editor700 preview_"],
    ["grows the pane by as little as a pixel", () => look(editor(501).layout), "modules500 calendar500 editor501 preview499"],
    ["counts a pane within a pixel of its widest as at its widest (rounding)", () => look(editor(499).layout), "modules500 calendar500 editor400 preview500"],
    ["grows a pane wider than its widest as wide as the row can make it", () => look(growOrShrink(edit({ calendar: { maxWidth: 300 } }), "calendar", [])!.layout), "modules- calendar2000 editor- preview-"],
    ["shrinks a pane at its widest to its narrowest", () => look(editor(500).layout), "modules500 calendar500 editor400 preview500"],
    ["shrinking, brings back what growing displaced", () => look(growOrShrink(editor(700).layout, "editor", editor(700).records)!.layout), "modules500 calendar500 editor400 preview500"],
    ["does nothing to a collapsed pane", () => growOrShrink(edit({ editor: { collapsed: true } }), "editor", []), undefined],
  ]);
});

describe("a drag", () => {
  const start = (layout = row, records: Effect[] = []): Row => ({ layout, records, limits: { modules: {}, calendar: { max: 900 }, editor: {}, preview: {} } });
  // calendar and editor at their widest: what the drag frees on their side is empty room
  const capped = (panes: Record<string, Partial<Slab>>) => edit({ calendar: { maxWidth: 500 }, editor: { maxWidth: 500 }, ...panes });
  const square = (d: number, layout = row) => dragEdge(start(layout), 1, d, "calendar").left;
  rules([
    ["forgets what earlier cascades did to the panes it pushes again, the edge staying where it was dragged", () => dragEdge(start(edit({ editor: { width: 400 } }), [narrowed("editor", 500)]), 4, -100).left.layout, edit({ editor: { width: 400 }, preview: { width: 400 } }, { free: 100 })],
    ["dragged left, brings back what earlier cascades did on the right with the room it leaves there", () => look(dragEdge(start(capped({ preview: { collapsed: true } }), [{ id: "preview", kind: "collapse", width: 500 }]), 1, -480).left.layout), "modules_ calendar500 editor500 preview500"],
    ["dragged right, brings back what earlier cascades did on the left with the room it leaves there", () => look(dragEdge(start(capped({ modules: { collapsed: true } }), [{ id: "modules", kind: "collapse", width: 500 }]), 3, 480).left.layout), "modules500 calendar500 editor500 preview_"],
    ["remembers its own effects after what is still waiting", () => kinds(dragEdge(start(row, [narrowed("modules", 700)]), 1, 150).left.records), ["narrow modules", "narrow calendar", "narrow editor"]],
    ["dragged back where it began, leaves the row as it began", () => square(0), start()],
    ["from a resize square, takes its own pane past its widest", () => look(square(-300, edit({ calendar: { maxWidth: 600 } }, { lead: 300 })).layout), "modules500 calendar800 editor500 preview500"],
    ["from a resize square, moves its own pane's widest to where it ended", () => square(-300, edit({ calendar: { maxWidth: 600 } }, { lead: 300 })).limits.calendar, { max: 800 }],
    ["from a resize square, takes the panes giving way past their narrowest", () => look(square(680).layout), "modules1180 calendar_ editor300 preview500"],
    ["from a resize square, moves their narrowest to where they ended", () => square(680).limits.editor, { min: 300 }],
    ["from a resize square, keeps the limits of the panes it didn't take past them", () => square(680).limits.calendar, { max: 900 }],
    ["from a resize square shrinking its own pane, keeps the other side's panes within their widest", () => square(50, edit({ modules: { maxWidth: 520 } })).layout.lead, 30],
    ["from a resize square dragged the other way, takes the panes before it past their narrowest", () => look(square(-300).layout), "modules200 calendar800 editor500 preview500"],
    ["from a resize square, leaves a narrowest a pane ends right at as it was", () => square(100).limits, start().limits],
    ["from a resize square, leaves a widest a pane ends right at as it was", () => square(-100, edit({ calendar: { maxWidth: 600 } }, { lead: 100 })).limits, start().limits],
  ]);
});

describe("a drag let go and picked up again", () => {
  const begun: Row = { layout: row, records: [], limits: {} };
  const last: LetGo = { key: "1:", start: begun, moved: 150, left: dragEdge(begun, 1, 150).left };
  const now = (layout: Parameters<typeof edit>[0], rest: Partial<Layout> = {}) => ({ ...last.left, layout: edit(layout, rest, last.left.layout) });
  rules([
    ["carries on while the row is as it left it, give or take rounding", () => carriesOn(last, "1:", now({ editor: { width: 453 } }, { free: 3, lead: 3 })), true],
    ["starts afresh when no drag was let go yet", () => carriesOn(null, "1:", last.left), false],
    ["starts afresh from another handle", () => carriesOn(last, "2:", last.left), false],
    ["starts afresh after a width changed by more than rounding", () => carriesOn(last, "1:", now({ editor: { width: 454 } })), false],
    ["starts afresh after a pane collapsed", () => carriesOn(last, "1:", now({ preview: { collapsed: true } })), false],
    ["starts afresh after the panes were reordered, the widths the same", () => carriesOn({ ...last, left: begun }, "1:", { ...begun, layout: { ...row, slabs: [row.slabs[1], row.slabs[0], ...row.slabs.slice(2)] } }), false],
    ["starts afresh after what was displaced changed", () => carriesOn(last, "1:", { ...last.left, records: [] }), false],
    ["starts afresh after a limit changed", () => carriesOn(last, "1:", { ...last.left, limits: { editor: { min: 450 } } }), false],
  ]);
});

describe("a row a link asked for, fitted to the window before it is shown (Modules and Calendar collapsed, the editor at 600 and the preview at 500)", () => {
  const asked = (free: number) => edit({ modules: { collapsed: true }, calendar: { collapsed: true }, editor: { width: 600, minWidth: 300 }, preview: { width: 500 } }, { free });
  const at = (free: number) => fitAsked(asked(free));
  rules([
    ["with room for what was asked: nothing gives way", () => at(0), undefined],
    ["a little short: the bars before the panes asked open leave the page, farthest first, only as many as it takes", () => [look(at(-15)!.layout), kinds(at(-15)!.records)], ["modules- calendar_ editor600 preview500", ["hide modules"]]],
    ["shorter: both bars leave", () => look(at(-30)!.layout), "modules- calendar- editor600 preview500"],
    ["shorter than the bars make up: the first open pane keeps the width asked, the next narrows", () => look(at(-100)!.layout), "modules- calendar- editor600 preview440"],
    ["shorter still: the rest give way as in any row too wide", () => look(at(-400)!.layout), "modules- calendar- editor600 preview_"],
    ["remembers every effect, from the widths asked", () => at(-400)!.records, [
      { id: "modules", kind: "hide", width: 500 },
      { id: "calendar", kind: "hide", width: 500 },
      { id: "preview", kind: "narrow", width: 500 },
      { id: "preview", kind: "collapse", width: 400 },
    ]],
    ["so the row asked for comes back as the window grows", () => look(restore({ ...at(-400)!.layout, free: 1000 }, at(-400)!.records).layout), "modules_ calendar_ editor600 preview500"],
    ["a row with nothing open is left as asked", () => fitAsked(edit(Object.fromEntries(row.slabs.map((s) => [s.id, { collapsed: true }])), { free: -10 })), undefined],
  ]);
});

describe("the room a row has, for a row not on the page yet", () => {
  const onPage = edit({ modules: { collapsed: true }, calendar: { hidden: true }, editor: { width: 600 } }, { free: 37, lead: 5, gap: 2 });
  it("is such that the row on the page, asked for again as it is, is left with the empty room it has", () => {
    expect(rowAsked(onPage.slabs, roomOf(onPage)).free).toBe(37 + 5);
    expect(rowAsked(onPage.slabs, roomOf(onPage))).toMatchObject({ lead: 0, bar: 20, gap: 2, least: 20 });
  });
  it("leaves a wider row less, a pane's bar counting for a collapsed pane and nothing for one off the page", () => {
    const room = roomOf({ ...row, free: 0 });
    expect(rowAsked(edit({ editor: { width: 700 } }).slabs, room).free).toBe(-200);
    expect(rowAsked(edit({ editor: { collapsed: true } }).slabs, room).free).toBe(480);
    expect(rowAsked(edit({ editor: { hidden: true } }).slabs, room).free).toBe(500);
  });
  it("counts the gaps between the panes on the page", () => {
    const room = roomOf({ ...row, free: 0, gap: 10 });
    expect(rowAsked(edit({ editor: { hidden: true }, preview: { hidden: true } }).slabs, room).free).toBe(1000 + 20);
  });
  it("shares what is left among the open panes asked for with no width, each at least its narrowest", () => {
    const room = roomOf({ ...row, free: 0 });
    const asked = edit({ modules: { collapsed: true }, calendar: { collapsed: true } }).slabs;
    expect(look(rowAsked(asked, room, ["editor", "preview"]))).toBe("modules_ calendar_ editor980 preview980");
    expect(look(rowAsked(asked, room, ["preview"]))).toBe("modules_ calendar_ editor500 preview1460");
    expect(look(rowAsked(edit({}).slabs, { ...room, total: 1500 }, ["editor", "preview"]))).toBe("modules500 calendar500 editor400 preview400");
  });
});

describe("how much wider the window is than when what is waiting gave way", () => {
  rules([
    ["nothing waiting: nothing gained, and the window as it is is where gains count from", () => windowGain(1000, 1400, false), { gained: 0, from: 1400 }],
    ["something waiting: every bit of growth since counts, however small each step was", () => [windowGain(1000, 1010, true), windowGain(1000, 1300, true)], [{ gained: 10, from: 1000 }, { gained: 300, from: 1000 }]],
    ["narrower than that: nothing gained, and gains count from the narrower window", () => windowGain(1000, 900, true), { gained: 0, from: 900 }],
    ["a row asked for in a window too narrow for it: the room it leaves empty counts as gained already, so what gave way is back as soon as it fits", () => windowGain(gainsFromAsked(900, 200), 1150, true).gained, 450],
    ["a row asked for that leaves no room: gains count from the window as it is", () => gainsFromAsked(900, -3), 900],
  ]);
});

describe("what a wider window would bring back", () => {
  const records: Effect[] = [
    { id: "modules", kind: "hide", width: 400 },
    { id: "calendar", kind: "hide", width: 400 },
    { id: "preview", kind: "narrow", width: 500 },
    { id: "preview", kind: "collapse", width: 400 },
  ];
  it("is each pane waiting, once, the first to come back first, with what happened to it last", () => {
    expect(comingBack(records)).toEqual([
      { id: "preview", kind: "collapse" },
      { id: "calendar", kind: "hide" },
      { id: "modules", kind: "hide" },
    ]);
    expect(comingBack([])).toEqual([]);
  });
});
