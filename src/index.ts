import { ExtensionContext } from "@foxglove/extension";
import { initTreePanel } from "./TreePanel";

export function activate(extensionContext: ExtensionContext) {
  extensionContext.registerPanel({ 
    name: "py-trees-viewer", 
    initPanel: initTreePanel 
  });
}
