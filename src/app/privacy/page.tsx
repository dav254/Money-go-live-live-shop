
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicyPage() {
    return (
        <MainLayout>
            <div className="container mx-auto max-w-4xl py-12">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">Privacy Policy</CardTitle>
                        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
                    </CardHeader>
                    <CardContent className="prose dark:prose-invert max-w-none">
                        <h2>1. Information We Collect</h2>
                        <p>We collect information you provide directly to us, such as when you create an account, upload content, or communicate with us. This may include:</p>
                        <ul>
                            <li><strong>Account Information:</strong> Your name, email address, password, phone number, and user role.</li>
                            <li><strong>Content Information:</strong> Photos, videos, descriptions, and other information you provide for your products and profile.</li>
                            <li><strong>Transactional Information:</strong> Details about purchases, sales, and payouts. Note: We do not store full payment card details.</li>
                        </ul>

                        <h2>2. How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul>
                            <li>Provide, maintain, and improve our Services.</li>
                            <li>Process transactions and send you related information, including confirmations and invoices.</li>
                            <li>Communicate with you about products, services, offers, and events.</li>
                            <li>Monitor and analyze trends, usage, and activities in connection with our Services.</li>
                            <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
                        </ul>

                        <h2>3. Sharing of Information</h2>
                        <p>We may share information about you as follows or as otherwise described in this Privacy Policy:</p>
                        <ul>
                            <li>With other users on the platform, for example, your shop name and products will be public.</li>
                            <li>With vendors, consultants, and other service providers who need access to such information to carry out work on our behalf (e.g., payment processors).</li>
                            <li>In response to a request for information if we believe disclosure is in accordance with any applicable law, regulation, or legal process.</li>
                        </ul>

                        <h2>4. Data Security</h2>
                        <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</p>

                        <h2>5. Your Choices</h2>
                        <p>You may update, correct or delete information about you at any time by logging into your online account or emailing us. If you wish to delete or deactivate your account, please email us, but note that we may retain certain information as required by law or for legitimate business purposes.</p>
                        
                        <h2>6. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at: support@goearn.com</p>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
