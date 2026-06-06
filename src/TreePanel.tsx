import { PanelExtensionContext, MessageEvent } from "@foxglove/extension";
import { createRoot } from "react-dom/client";
import { BehaviorTreeUI } from "./BehaviorTreeUI";

// Define the shape of the incoming PyTrees ROS message
type BehaviourMsg = {
  name: string;
  type: number;
  status: number;
  own_id: { uuid: number[] };
  parent_id: { uuid: number[] };
  child_ids: { uuid: number[] }[];
  is_active: boolean;
};

type BehaviourTreeMsg = {
  changed: boolean;
  behaviours: BehaviourMsg[];
  blackboard_on_visited_path: { key: string; value: string }[];
};

export function initTreePanel(context: PanelExtensionContext) {
  const rootElement = document.createElement("div");
  rootElement.style.height = "100%";
  context.panelElement.appendChild(rootElement);
  const root = createRoot(rootElement);

  // 1. Tell Foxglove we want to trigger a render when a new frame/message arrives
  context.watch("currentFrame");

  // 2. Subscribe to the Snapshot topic
  context.subscribe([{ topic: "/planner_root_tree/snapshots" }]);

  // 4. The Render Loop
  context.onRender = (renderState, done) => {
    // Find our tree messages in the current frame
    const treeMessages = renderState.currentFrame?.filter(
      (msg) => msg.topic === "/planner_root_tree/snapshots"
    );

    if (treeMessages && treeMessages.length > 0) {
      // Get the most recent message
      const latestMsg = treeMessages[treeMessages.length - 1] as unknown as MessageEvent<BehaviourTreeMsg>;
      
      // Render our React Component
      root.render(
        <BehaviorTreeUI 
          treeData={latestMsg.message} 
        />
      );
    }
    
    // Tell Foxglove we are done rendering this frame
    done();
  };

  // Cleanup when the user closes the panel
  return () => {
    root.unmount();
  };
}
