import { Composition } from "remotion";
import { NextProShort, NEXTPRO_FRAMES } from "./videos/nextpro/NextPro";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NextProShort"
        component={NextProShort}
        durationInFrames={NEXTPRO_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
