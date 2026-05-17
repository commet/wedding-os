// Remotion CLI 의 entry-point. `npx remotion render src/video/index.ts WeddingVideo ...`
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
