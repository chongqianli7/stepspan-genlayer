export const example = {
  venue: "Northlight Museum · fictional example",
  url: "https://example.org/fictional-access",
  nodes: [
    { id: "street", label: "Street entrance" },
    { id: "foyer", label: "Foyer" },
    { id: "lift", label: "North lift" },
    { id: "gallery", label: "Gallery 2" },
  ],
  edges: [
    { id: "E1", from: "street", to: "foyer" },
    { id: "E2", from: "foyer", to: "lift" },
    { id: "E3", from: "lift", to: "gallery" },
    { id: "E4", from: "foyer", to: "gallery" },
  ],
  start: "street",
  end: "gallery",
};
export const source =
  "The street entrance offers step-free access to the foyer. A level corridor connects the foyer to the North lift. The North lift is available to visitors. The direct route from the foyer to Gallery 2 has twelve steps.";
export const findings = {
  edges: [
    {
      id: "E1",
      state: "PASS",
      quote: "The street entrance offers step-free access to the foyer.",
    },
    {
      id: "E2",
      state: "PASS",
      quote: "A level corridor connects the foyer to the North lift.",
    },
    { id: "E3", state: "UNKNOWN", quote: "" },
    {
      id: "E4",
      state: "BLOCKED",
      quote: "The direct route from the foyer to Gallery 2 has twelve steps.",
    },
  ],
};
export const official = {
  venue: "General Grant National Memorial · visitor center",
  url: "https://www.nps.gov/gegr/planyourvisit/accessibility.htm",
  nodes: [
    {
      id: "sidewalk",
      label: "Riverside Drive sidewalk north of overlook pavilion",
    },
    { id: "visitor_center", label: "Visitor center entrance via ramp" },
  ],
  edges: [{ id: "E1", from: "sidewalk", to: "visitor_center" }],
  start: "sidewalk",
  end: "visitor_center",
};
