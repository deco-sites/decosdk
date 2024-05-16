import { allowCorsFor } from "deco/mod.ts";
import { AppContext } from "../apps/site.ts";

export interface TrackElement {
  cssSelector: string;
  eventType: "click" | "hover";
  eventName: string;
}

export interface Code {
  /**
   * @title JavaScript to run
   * @format code
   * @language javascript
   */
  injectedScript?: string;
  /**
   * @title CSS to run
   * @format code
   * @language css
   */
  injectedStyle?: string;
}

export interface Props {
  name: string;
  /**
   * @maxItems 2
   */
  variants: Code[];
  trackedElements?: TrackElement[];
}

/**
 * @title Layout Effects
 */
const loader = (
  { name, variants, trackedElements }: Props,
  req: Request,
  ctx: AppContext,
) => {
  Object.entries(allowCorsFor(req)).map(([name, value]) => {
    ctx.response.headers.set(name, value);
  });

  return {
    name,
    variants,
    trackedElements,
  };
};

export default loader;
