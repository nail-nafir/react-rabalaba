import { LearnContent } from "@/features/learn/components/learn-content";

export default function LearnPage() {
  return (
    <div className="w-full bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
        <LearnContent />
      </div>
    </div>
  );
}
