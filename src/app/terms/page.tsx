
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

                        <h2>8. Marketplace Role</h2>
                        <p>Go Earn is a digital platform that connects buyers, sellers, and resellers. We do not own or manufacture the products listed on the platform. We are not responsible for product quality, delivery timelines, or interactions between users. You agree that all purchases are made directly from third-party sellers.</p>

                        <h2>9. Reseller Program</h2>
                        <p>If you join the Reseller Program:</p>
                        <ul>
                            <li>You earn commissions only when a verified purchase is completed.</li>
                            <li>Fraud activities — fake orders, repeated self-purchases, or manipulating links — will result in instant suspension.</li>
                            <li>Commission rates may change at any time depending on product category or seller promotions.</li>
                        </ul>

                        <h2>10. Payments & Payouts</h2>
                        <p>Go Earn processes payouts using mobile money, bank transfers, or other approved methods. By using Go Earn, you agree that:</p>
                        <ul>
                            <li>Payouts take place after order verification.</li>
                            <li>Refunds or disputes may delay payments.</li>
                            <li>You must provide correct payment information to receive earnings.</li>
                            <li>Go Earn may hold funds temporarily for fraud prevention or security checks.</li>
                        </ul>

                        <h2>11. Orders, Shipping, & Delivery</h2>
                        <p>All deliveries are handled by sellers or approved shipping partners. Go Earn is not responsible for:</p>
                        <ul>
                            <li>Delays</li>
                            <li>Lost parcels</li>
                            <li>Wrong addresses provided by buyers</li>
                            <li>Shipping fees or customs fees</li>
                        </ul>
                        <p>Buyers must confirm product details before ordering.</p>

                        <h2>12. Refunds & Disputes</h2>
                        <p>Refunds may be approved only under the following conditions:</p>
                        <ul>
                            <li>Product not delivered</li>
                            <li>Product significantly different from what was advertised</li>
                            <li>Seller confirmed cancellation</li>
                        </ul>
                        <p>Users must open disputes within 48 hours of receiving the product, including evidence such as photos or video. Go Earn reserves the right to make the final decision.</p>

                        <h2>13. Video & Content Rules</h2>
                        <p>By uploading videos or images, you agree that:</p>
                        <ul>
                            <li>Content must be real and related to your product</li>
                            <li>No misleading, stolen, or AI-fake product videos</li>
                            <li>No nudity, violence, drugs, or harmful materials</li>
                            <li>No copyrighted music unless permitted</li>
                        </ul>
                        <p>Violations may result in content removal or account termination.</p>

                        <h2>14. Live Shopping Rules</h2>
                        <p>During livestreams:</p>
                        <ul>
                            <li>Sellers must show real products</li>
                            <li>No fake viewers, fake comments, or fake engagement</li>
                            <li>No abusive language</li>
                            <li>No external payment methods (all payments must go through Go Earn)</li>
                        </ul>
                        <p>Breaking these rules may lead to suspension.</p>

                        <h2>15. Seller Responsibilities</h2>
                        <p>Sellers must:</p>
                        <ul>
                            <li>Provide truthful product descriptions</li>
                            <li>Ship items on time</li>
                            <li>Respond to messages promptly</li>
                            <li>Honor warranties and guarantees</li>
                            <li>Accept returns when required by policy</li>
                        </ul>
                        <p>Sellers who fail to meet standards may be removed.</p>

                        <h2>16. Data Protection & Privacy</h2>
                        <p>Go Earn collects user data such as: profile information, purchase activity, device information, and messages between buyers and sellers (for safety monitoring). We do not sell personal data to third parties. Your information is used only to improve platform safety and experience.</p>

                        <h2>17. Intellectual Property</h2>
                        <p>All Go Earn branding, designs, logos, and platform features are protected. You may not copy, clone, modify, or reverse-engineer any part of the platform without permission.</p>

                        <h2>18. Age Requirements</h2>
                        <p>You must be 18 years or older to create a seller or reseller account. Minors may only use buyer accounts with parental supervision.</p>
                        
                        <h2>19. Community Safety & Reporting</h2>
                        <p>Users must report: fraudulent sellers, fake items, harmful content, scam behavior, or unauthorized transactions. Go Earn may disable accounts involved in harmful behavior.</p>

                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
