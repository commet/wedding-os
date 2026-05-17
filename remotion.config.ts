// Remotion CLI 설정. `npx remotion render` 가 자동으로 읽는다.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(2);
Config.setOverwriteOutput(true);
