import { Node, UITransform } from 'cc';

/** Entity visual 内部节点只需要基础尺寸能力，避免反向依赖 board renderer 工具。 */
export function setEntityVisualNodeSize(node: Node, width: number, height: number): void {
  const uiTransform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  uiTransform.setContentSize(width, height);
}
