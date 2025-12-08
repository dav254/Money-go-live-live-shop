
import PreviewPlayer from "@/components/studio/PreviewPlayer";
import PublishButton from "@/components/studio/PublishButton";

export default function Preview() {
  return (
    <div className="bg-black text-white h-screen">
      <div className="relative h-full">
        <PreviewPlayer />
        <div className="absolute bottom-20 right-4">
          <div className="flex flex-col items-center space-y-4">
            <button className="bg-white/30 p-3 rounded-full"><span className="text-3xl">❤️</span><br /><span className="text-xs">10k</span></button>
            <button className="bg-white/30 p-3 rounded-full"><span className="text-3xl">💬</span><br /><span className="text-xs">200</span></button>
            <button className="bg-white/30 p-3 rounded-full"><span className="text-3xl">🔗</span><br /><span className="text-xs">Share</span></button>
            <button className="bg-white/30 p-3 rounded-full"><span className="text-3xl">...</span></button>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <PublishButton />
        </div>
      </div>
    </div>
  );
}
