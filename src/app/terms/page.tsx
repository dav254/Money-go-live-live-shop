
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfServicePage() {
    return (
        <MainLayout>
            <div className="container mx-auto max-w-4xl py-12">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">Terms of Service</CardTitle>
                        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
                    </CardHeader>
                    <CardContent className="prose dark:prose-invert max-w-none">
                        <h2>1. Introduction</h2>
                        <p>Welcome to Go Earn! These Terms of Service ("Terms") govern your use of our website, mobile applications, and services (collectively, "Services"). By accessing or using our Services, you agree to be bound by these Terms.</p>

                        <h2>2. User Accounts</h2>
                        <p>To use most features of the Services, you must register for an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.</p>

                        <h2>3. Content</h2>
                        <p>You are responsible for any content you post, upload, or otherwise make available through the Services ("Your Content"). You retain ownership of Your Content, but you grant Go Earn a worldwide, non-exclusive, royalty-free license to use, reproduce, and display it in connection with the Services.</p>

                        <h2>4. Prohibited Conduct</h2>
                        <p>You agree not to engage in any of the following prohibited activities: (a) copying, distributing, or disclosing any part of the Services in any medium; (b) using any automated system to access the Services; (c) transmitting spam or other unsolicited email; (d) attempting to interfere with the system integrity or security.</p>
                        
                        <h2>5. Termination</h2>
                        <p>We may terminate or suspend your account and bar access to the Services immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.</p>

                        <h2>6. Limitation of Liability</h2>
                        <p>In no event shall Go Earn, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Services.</p>

                        <h2>7. Changes to Terms</h2>
                        <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page.</p>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
