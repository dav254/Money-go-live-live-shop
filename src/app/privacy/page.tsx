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
                        <p>Welcome to Go Earn. We are committed to protecting your privacy and handling your data in an open and transparent manner. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.</p>
                        
                        <h2 className="mb-4">1. Information We Collect</h2>
                        <p>We collect information to provide and improve our services. The types of information we collect include:</p>
                        <ul>
                            <li><strong>Account Information:</strong> When you register, we collect your full name, username, email address, password, and chosen user role (Buyer or Seller). We may also collect your phone number for verification and communication.</li>
                            <li><strong>Profile Information:</strong> You may choose to provide additional information for your public profile, such as a profile picture, biography, and location.</li>
                            <li><strong>Shop Information (for Sellers):</strong> We collect your shop name, logo, banner, and business policies (e.g., return and delivery info).</li>
                            <li><strong>User-Generated Content:</strong> We collect all content you upload, including product videos, images, descriptions, prices, reviews, comments, and live stream content.</li>
                            <li><strong>Transactional Information:</strong> We collect details about transactions you conduct on the platform, including products purchased or sold, order details, shipping addresses, payment method types (e.g., 'PayPal', 'card'), and transaction amounts. We do **not** directly store your credit card number; this is handled by our secure payment processors.</li>
                            <li><strong>Financial Information (for Sellers):</strong> To facilitate payouts, we collect your payout method details, such as PayPal email or bank account information.</li>
                            <li><strong>Usage Data:</strong> We automatically collect information about your interactions with our Services, such as product views, likes, shares, and search queries.</li>
                        </ul>

                        <h2 className="mb-4">2. How We Use Your Information</h2>
                        <p>Your information is used to power the Go Earn platform and its features:</p>
                        <ul>
                            <li>To operate and maintain the marketplace, including facilitating transactions between buyers and sellers.</li>
                            <li>To manage your account, provide customer support, and communicate with you.</li>
                            <li>To process payments for purchases and facilitate payouts for sellers.</li>
                            <li>To display your public profile, shop, and product listings to other users.</li>
                            <li>To power our AI features, such as providing product recommendations, generating content, and detecting fraudulent activity.</li>
                            <li>To analyze usage trends to improve our Services and user experience.</li>
                            <li>To enforce our Terms of Service and prevent prohibited activities.</li>
                        </ul>

                        <h2 className="mb-4">3. How We Share Your Information</h2>
                        <p>We only share your information in the following circumstances:</p>
                        <ul>
                            <li><strong>Between Users:</strong> To complete a transaction, we share the buyer's shipping address with the seller. Your public profile, shop, and content are visible to all users.</li>
                            <li><strong>With Service Providers:</strong> We use third-party companies for services like payment processing (PayPal, Paystack), cloud hosting (Firebase), and media storage (Cloudinary). These companies are authorized to use your information only as necessary to provide services to us.</li>
                            <li><strong>For Legal Reasons:</strong> We may disclose your information if required by law or in response to a valid legal request.</li>
                            <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</li>
                        </ul>

                        <h2 className="mb-4">4. User-Generated Content</h2>
                        <p>Please be aware that any content you post publicly—such as product videos, reviews, and comments—can be seen, collected, and used by others. Avoid sharing sensitive personal information in your public content.</p>

                        <h2 className="mb-4">5. Data Security</h2>
                        <p>We implement a variety of security measures, including encryption and access controls, to maintain the safety of your personal information. However, no method of transmission over the Internet is 100% secure.</p>

                        <h2 className="mb-4">6. Your Data Rights</h2>
                        <p>You have rights over your personal data. You can access and update your account information through your profile settings. You may also request deletion of your account. Please note that we may retain certain information for legal, accounting, or security purposes, such as records of transactions.</p>
                        
                        <h2 className="mb-4">7. Children’s Privacy</h2>
                        <p>Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child without parental consent, we will take steps to remove that information.</p>

                        <h2 className="mb-4">8. Changes to This Policy</h2>
                        <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>

                        <h2 className="mb-4">9. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:support@goearn.com">support@goearn.com</a>.</p>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
