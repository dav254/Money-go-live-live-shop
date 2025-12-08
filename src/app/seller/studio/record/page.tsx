
import Recorder from "@/components/studio/Recorder";

export default function Record() {
  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <h1 className="text-xl font-bold p-4">Record Your Product Video</h1>
      <Recorder />
    </div>
  );
}
