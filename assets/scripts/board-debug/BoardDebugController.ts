import { _decorator, Color, Component, Label, Node, UITransform, Vec3, Widget } from 'cc';
import { BoardBootstrap } from '../board-bootstrap/BoardBootstrap.ts';
import { createBoardDebugApi, formatBoardDebugStatus } from './board-debug-api';
import type { BoardDebugHost } from '../shared/types.ts';

const { ccclass, property } = _decorator;

const DEBUG_CONSOLE_PATH = 'globalThis.boardDebug';

/**
 * 调试模块组件：
 * - 挂载 `globalThis.boardDebug`
 * - 管理调试状态标签
 * - 通过显式 host 契约访问主棋盘能力
 */
@ccclass('BoardDebugController')
export class BoardDebugController extends Component {
  @property(BoardBootstrap)
  private boardBootstrap: BoardBootstrap | null = null;

  private boardHost: BoardDebugHost | null = null;
  private statusLabelNode: Node | null = null;
  private statusLabel: Label | null = null;
  private lastStatusText = '';

  /**
   * 调试组件通过 Inspector 显式绑定主棋盘组件；同节点挂载仅作为兼容兜底。
   * 主棋盘只暴露显式 host 契约，调试组件不读取其私有字段。
   */
  onLoad(): void {
    const boardBootstrap = this.boardBootstrap ?? this.node.getComponent(BoardBootstrap);
    if (!boardBootstrap) {
      console.warn('BoardDebugController requires a BoardBootstrap reference.');
      return;
    }

    this.boardHost = boardBootstrap.getDebugHost(() => this.getNodeTreeText());
    this.ensureStatusLabel();
    this.mountConsoleBridge();
    this.refreshStatus();
  }

  update(): void {
    if (!this.boardHost || !this.statusLabel) {
      return;
    }
    this.refreshStatus();
  }

  onDestroy(): void {
    const globalTarget = globalThis as { boardDebug?: unknown };
    if (globalTarget.boardDebug) {
      delete globalTarget.boardDebug;
    }
  }

  private ensureStatusLabel(): void {
    if (this.statusLabelNode) {
      return;
    }

    const overlayLayerNode = this.node.getChildByName('OverlayLayerNode') ?? this.createChild(this.node, 'OverlayLayerNode');
    this.setNodeSize(overlayLayerNode, 720, 1280);

    this.statusLabelNode =
      overlayLayerNode.getChildByName('StatusLabelNode') ?? this.createChild(overlayLayerNode, 'StatusLabelNode');
    this.statusLabelNode.setPosition(new Vec3(-250, 550, 0));
    this.setNodeSize(this.statusLabelNode, 420, 220);
    const widget = this.statusLabelNode.getComponent(Widget) ?? this.statusLabelNode.addComponent(Widget);
    widget.isAlignTop = true;
    widget.isAlignLeft = true;
    widget.top = 32;
    widget.left = 32;

    this.statusLabel = this.statusLabelNode.getComponent(Label) ?? this.statusLabelNode.addComponent(Label);
    this.statusLabel.fontSize = 24;
    this.statusLabel.lineHeight = 32;
    this.statusLabel.color = new Color(226, 232, 240, 255);
  }

  private mountConsoleBridge(): void {
    if (!this.boardHost) {
      return;
    }

    const api = createBoardDebugApi(this.boardHost);
    (globalThis as { boardDebug?: typeof api }).boardDebug = api;
  }

  private refreshStatus(): void {
    if (!this.boardHost || !this.statusLabel) {
      return;
    }

    const state = this.boardHost.getState();
    const statusText = formatBoardDebugStatus({
      ballsCount: state.balls.length,
      paused: this.boardHost.isPaused(),
      entryCoord: state.entryCoord,
      consolePath: DEBUG_CONSOLE_PATH,
    });

    if (statusText === this.lastStatusText) {
      return;
    }

    this.lastStatusText = statusText;
    this.statusLabel.string = statusText;
  }

  private setNodeSize(node: Node, width: number, height: number): void {
    const uiTransform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    uiTransform.setContentSize(width, height);
  }

  private createChild(parentNode: Node, name: string): Node {
    const childNode = new Node(name);
    childNode.setParent(parentNode);
    return childNode;
  }

  private getNodeTreeText(): string {
    let nodeTreeText = '';
    const walk = (node: Node, depth: number): void => {
      const prefix = `|${'--'.repeat(depth + 1)} `;
      nodeTreeText += `${prefix}${node.name}\n`;
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    };
    walk(this.node, 0);
    return nodeTreeText;
  }
}
