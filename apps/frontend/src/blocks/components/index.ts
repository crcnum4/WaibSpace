import { registerBlocks } from "../registry";

import { Container } from "./primitives/Container";
import { Row } from "./primitives/Row";
import { Stack } from "./primitives/Stack";
import { Grid } from "./primitives/Grid";
import { Text } from "./primitives/Text";
import { Button } from "./primitives/Button";
import { Badge } from "./primitives/Badge";
import { List } from "./primitives/List";
import { ListItem } from "./primitives/ListItem";
import { Image } from "./primitives/Image";
import { Expandable } from "./primitives/Expandable";
import { TextInput } from "./primitives/TextInput";
import { Divider } from "./primitives/Divider";

export { FallbackBlock } from "./FallbackBlock";

/**
 * Register all 13 built-in primitive block components.
 * Call this once at application startup before rendering any block trees.
 */
export function registerPrimitiveBlocks(): void {
  registerBlocks([
    { type: "Container", component: Container, registration: { type: "Container", category: "primitive", source: "builtin", description: "Flex container with configurable direction, gap, and padding" } },
    { type: "Row", component: Row, registration: { type: "Row", category: "primitive", source: "builtin", description: "Horizontal flex layout shorthand" } },
    { type: "Stack", component: Stack, registration: { type: "Stack", category: "primitive", source: "builtin", description: "Vertical flex layout shorthand" } },
    { type: "Grid", component: Grid, registration: { type: "Grid", category: "primitive", source: "builtin", description: "CSS grid layout with configurable columns" } },
    { type: "Text", component: Text, registration: { type: "Text", category: "primitive", source: "builtin", description: "Text display with semantic variants" } },
    { type: "Button", component: Button, registration: { type: "Button", category: "primitive", source: "builtin", description: "Clickable button with variant styles" } },
    { type: "Badge", component: Badge, registration: { type: "Badge", category: "primitive", source: "builtin", description: "Small indicator badge (dot, label, or count)" } },
    { type: "List", component: List, registration: { type: "List", category: "primitive", source: "builtin", description: "List container with gap spacing" } },
    { type: "ListItem", component: ListItem, registration: { type: "ListItem", category: "primitive", source: "builtin", description: "Interactive list entry with hover effect" } },
    { type: "Image", component: Image, registration: { type: "Image", category: "primitive", source: "builtin", description: "Image with loading and error states" } },
    { type: "Expandable", component: Expandable, registration: { type: "Expandable", category: "primitive", source: "builtin", description: "Collapsible section with toggle header" } },
    { type: "TextInput", component: TextInput, registration: { type: "TextInput", category: "primitive", source: "builtin", description: "Text input or textarea with change events" } },
    { type: "Divider", component: Divider, registration: { type: "Divider", category: "primitive", source: "builtin", description: "Visual separator (line or space)" } },
  ]);
}
