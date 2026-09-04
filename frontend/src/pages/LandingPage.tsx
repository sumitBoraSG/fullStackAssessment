import React from "react";
import { LandingHeader } from "../components/landing/LandingHeader";
import { HeroSection } from "../components/landing/HeroSection";
import { WhatWeDoSection } from "../components/landing/WhatWeDoSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { ForPatientsSection } from "../components/landing/ForPatientsSection";
import { ForDoctorsSection } from "../components/landing/ForDoctorsSection";
import { FinalCtaSection } from "../components/landing/FinalCtaSection";
import { LandingFooter } from "../components/landing/LandingFooter";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F0EEE6] text-[#141413] font-sans">
      <LandingHeader />
      <main>
        <HeroSection />
        <WhatWeDoSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ForPatientsSection />
        <ForDoctorsSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
};
