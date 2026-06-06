# PyTrees Foxglove Viewer

![PyTrees Viewer Preview](https://github.com/user-attachments/assets/677322b8-ad3e-453e-a3ac-f16cf5ea0675)

A custom Foxglove Studio extension panel designed to provide a rich, interactive visualization of ROS 2 `py_trees_ros` behavior trees. It listens to `/snapshots` topics published by PyTrees and renders them using ReactFlow and Dagre for clean, automatic top-down layouts.

## Features

- **Automatic Dagre Layout:** Dynamically arranges tree nodes into a top-down organization chart, smoothly adapting to tree structure changes.
- **Interactive Canvas:** Native pan/zoom controls using ReactFlow, allowing you to easily navigate massive, complex behavior trees.
- **Live Status Updates:** Nodes automatically change colors based on their exact ROS execution state:
  - 🟡 **RUNNING:** Deep Amber
  - 🟢 **SUCCESS:** Deep Green
  - 🔴 **FAILURE:** Deep Red
  - ⚫ **WAITING / INVALID:** Dark Blue / Gray
- **Success State Latching:** PyTrees `Sequence(memory=True)` drops skipped successful nodes back to `INVALID`. This extension intercepts those drops and visually "latches" the success state, giving you a beautiful green "trail" of completed tasks as the robot progresses through its mission.
- **Embedded Feedback Messages:** Displays raw `message` strings and `additional_detail` feedback directly on the node cards so you don't need to cross-reference terminal logs.
- **Focus Mode:** Click any node to instantly isolate and highlight the path from the root down to its active children, dimming everything else.
- **Interactive Blackboard:** Expandable, resizable sidebar that recursively parses and beautifies Python `__repr__` telemetry dumps into collapsable trees using native HTML `<details>` toggles.

## Installation

### From Source

1. Clone this repository into your workspace.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build and install into your local Foxglove Studio:
   ```sh
   npm run local-install
   ```
4. Reload Foxglove Studio (`Ctrl+R` or `Cmd+R`). The new "PyTrees Viewer" panel will be available in the "Add Panel" menu.

## Packaging and Publishing for your Team

If you want to share this extension with the rest of your organization so it automatically installs in everyone's Foxglove Studio, you can use the built-in Foxglove CLI.

### 1. Publish to your Organization
Make sure you have logged into the Foxglove CLI (`foxglove auth login`), then simply run:

```sh
npm run publish-org
```

This custom script will automatically package your extension and upload it directly to your organization's registry. Anyone in your organization will now have this extension automatically installed!

### 2. Manual Packaging (Share without CLI)
If you just want to generate the `.foxe` file to manually email or drag-and-drop:

```sh
npm run package
```

This will generate `mcgill-robotics.py-trees-foxglove-viewer-1.0.0.foxe`. Anyone can drag and drop this file directly into their Foxglove Studio window to install the extension instantly.

## Usage

**⚠️ IMPORTANT: ROS 2 Node Configuration**  
In order for this viewer to work, the ROS 2 node running your `py_trees_ros.trees.BehaviourTree` **must** have the following ROS parameters enabled. Otherwise, the tree topology and blackboard data will not be published over the network by default.

```yaml
default_snapshot_stream: true
default_snapshot_blackboard_data: true
```

1. Open Foxglove Studio and connect to your ROS 2 robot or replay a `.mcap` bag file.
2. Add a new panel and search for **PyTrees Viewer**.
3. The panel will automatically subscribe to behavior tree snapshot topics (such as `/planner_root_tree/snapshots`). 
4. Click and drag the canvas to pan, use your scroll wheel or trackpad to zoom in/out, and click the "Show Blackboard" button to toggle the sidebar!
