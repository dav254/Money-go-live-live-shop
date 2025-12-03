
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
                        <h2>1. Introduction</h2>
                        <p>This Privacy Policy explains how Go Earn ("we," "us," or "our") collects, uses, and discloses information about you when you access or use our website, mobile applications, and services (collectively, the "Services").</p>

                        <h2>2. Information We Collect</h2>
                        <p>We collect information you provide directly to us, such as when you create an account, upload content, or communicate with us. This may include:</p>
                        <ul>
                            <li><strong>Account Information:</strong> Your name, email address, password, phone number, and user role.</li>
                            <li><strong>Content Information:</strong> Photos, videos, descriptions, and other information you provide for your products and profile.</li>
                            <li><strong>Transactional Information:</strong> Details about purchases, sales, and payouts. Note: We do not store full payment card details.</li>
                        </ul>

                        <h2>3. How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul>
                            <li>Provide, maintain, and improve our Services.</li>
                            <li>Process transactions and send you related information, including confirmations and invoices.</li>
                            <li>Communicate with you about products, services, offers, and events.</li>
                            <li>Monitor and analyze trends, usage, and activities in connection with our Services.</li>
                            <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
                        </ul>

                        <h2>4. Sharing of Information</h2>
                        <p>We may share information about you as follows or as otherwise described in this Privacy Policy:</p>
                        <ul>
                            <li>With other users on the platform, for example, your shop name and products will be public.</li>
                            <li>With vendors, consultants, and other service providers who need access to such information to carry out work on our behalf (e.g., payment processors).</li>
                            <li>In response to a request for information if we believe disclosure is in accordance with any applicable law, regulation, or legal process.</li>
                        </ul>

                        <h2>5. Data Security</h2>
                        <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</p>
                        
                        <h2>6. Your Choices</h2>
                        <p>You may update, correct or delete information about you at any time by logging into your online account or emailing us. If you wish to delete or deactivate your account, please email us, but note that we may retain certain information as required by law or for legitimate business purposes.</p>

                        <h2>7. Children’s Privacy</h2>
                        <p>Go Earn is not intended for individuals under the age of 13. We do not knowingly collect personal information from children. If we discover that a child under 13 has created an account, we will immediately delete their information.</p>

                        <h2>8. Data Retention</h2>
                        <p>We retain your information only for as long as necessary to provide the Services, comply with legal obligations, resolve disputes, and enforce our agreements. Product listings, transaction records, and payout details may remain stored for auditing and compliance purposes.</p>

                        <h2>9. International Data Transfers</h2>
                        <p>Your information may be transferred to and processed in countries other than your own. We ensure such transfers are protected by security safeguards and applicable data protection laws.</p>

                        <h2>10. Third-Party Services</h2>
                        <p>Go Earn uses third-party tools and integrations such as payment processors, analytics services, cloud hosting providers, and SMS verification platforms. These third parties may collect information sent from your device. We are not responsible for the privacy practices of external services, but we ensure that we work only with trusted and compliant providers.</p>

                        <h2>11. Your Data Rights</h2>
                        <p>Depending on your location, you may have the following rights:</p>
                        <ul>
                            <li>Access your personal data</li>
                            <li>Request corrections</li>
                            <li>Request deletion</li>
                            <li>Download a copy of your data</li>
                            <li>Object to certain processing activities</li>
                            <li>Withdraw consent at any time</li>
                        </ul>
                        <p>To exercise these rights, email: support@goearn.com.</p>

                        <h2>12. Data Breach Procedures</h2>
                        <p>In the event of a data breach, Go Earn will take immediate steps to contain the incident, notify affected users when required, and cooperate with authorities to minimize risk and impact.</p>

                        <h2>13. User-Generated Content</h2>
                        <p>Any videos, photos, product descriptions, or public interactions you upload to Go Earn may be visible to other users. Please avoid sharing sensitive personal information in your content.</p>

                        <h2>14. Business Transfers</h2>
                        <p>If Go Earn is involved in a merger, acquisition, or asset sale, your personal information may be transferred as part of the transaction. You will be notified of any such change.</p>

                        <h2>15. Changes to This Policy</h2>
                        <p>We may update this Privacy Policy from time to time. When we make changes, we will revise the “Last Updated” date at the top of this page. Your continued use of the Services means you accept the updated policy.</p>

                        <h2>16. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at: support@goearn.com</p>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
