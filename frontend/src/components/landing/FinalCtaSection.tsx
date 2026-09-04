import React from "react";
import { useRouter } from "../../context/RouterContext";
import { Button } from "../ui/Button";
import { PulseLine } from "../decor/PulseLine";
import { CornerAccent } from "../decor/CornerAccent";
import { Reveal } from "./Reveal";
import { CtaArrow } from "./CtaArrow";

export const FinalCtaSection: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section className="relative overflow-hidden bg-[#E3DBCC] border-y border-[#D8D0BF]">
      <CornerAccent className="hidden sm:block absolute top-6 left-4 lg:top-10 lg:left-10" />
      <CornerAccent flipped className="hidden sm:block absolute bottom-6 right-4 lg:bottom-10 lg:right-10" />

      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="w-104 h-104 rounded-full border border-[#D8D0BF]" />
      </div>

      <Reveal className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center py-16 sm:py-20 lg:py-24">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#141413] m-0">
          Healthcare scheduling, without the friction.
        </h2>
        <p className="mt-4 text-sm sm:text-base text-[#141413]/60 leading-relaxed max-w-xl mx-auto">
          DocPulse keeps doctors and patients connected, from the first search to the final
          consultation. Create an account and see it for yourself.
        </p>

        <PulseLine className="mt-8 w-40 h-6 mx-auto opacity-30" />

        <div className="mt-8">
          <Button
            variant="primary"
            className="px-7 py-3"
            onClick={() => navigate("/register")}
          >
            <span>Get Started</span>
            <CtaArrow />
          </Button>
        </div>
      </Reveal>
    </section>
  );
};
