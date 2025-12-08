
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AiRecordsTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Records</CardTitle>
        <CardDescription>A record of AI-generated content and activities related to your products.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground">Coming Soon: This section will display a log of AI-powered actions, such as automatically generated product descriptions, background removals, and other enhancements.</p>
      </CardContent>
    </Card>
  );
}
