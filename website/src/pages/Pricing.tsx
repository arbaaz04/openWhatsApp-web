import { useEffect } from 'react';
import ChatBubble from '../components/ChatBubble';

interface Plan {
  name: string;
  price: string;
  desc: string;
  features: string[];
  ctaText: string;
  ctaUrl: string;
  featured?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    desc: 'Perfect for small shops starting with basic automated confirmations.',
    features: [
      '100 automated alerts per month',
      '1 connected WhatsApp number',
      'Direct official Meta API routing',
      'WhatsApp chat widget for storefront',
      'Basic shared team inbox (1 seat)',
      'Standard pre-approved templates',
    ],
    ctaText: 'Install Free',
    ctaUrl: 'https://apps.shopify.com/whatflow-official-api',
  },
  {
    name: 'Starter',
    price: '$4.99',
    desc: 'Collaborate with your team and scale your automated notifications.',
    features: [
      '1,000 automated alerts per month',
      '1 connected WhatsApp number',
      '2 shared team inbox seats',
      'Shopify order & fulfillment sync',
      '5 custom auto-reply rules',
      'Manual campaign blast manager',
    ],
    ctaText: 'Start Starter Trial',
    ctaUrl: 'https://apps.shopify.com/whatflow-official-api',
  },
  {
    name: 'Growth',
    price: '$14.99',
    desc: 'Unleash advanced chatbot automation, developer tools, and API webhooks.',
    features: [
      '10,000 automated alerts per month',
      '2 connected WhatsApp numbers',
      'Unlimited shared inbox seats',
      'Drag-and-drop flow builder',
      'Custom webhook events & REST API',
      'Priority live chat support',
    ],
    ctaText: 'Start Growth Trial',
    ctaUrl: 'https://app.whatflow.io',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '$29.99',
    desc: 'For high-volume brands requiring dedicated throughput and uptime SLAs.',
    features: [
      'Unlimited alerts & messages',
      'Dedicated BSP endpoint routing',
      'Dedicated account manager',
      'SSO & developer audit logs',
      'Custom webhook retry controls',
      'Full white-glove onboarding',
    ],
    ctaText: 'Contact Sales',
    ctaUrl: 'https://app.whatflow.io',
  },
];

export default function Pricing() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="wf-pricing-page">
      {/* Hero Section on Cream Canvas */}
      <section className="wf-pricing-hero wf-reveal wf-revealed">
        <h1 className="wf-pricing-title">Simple pricing, built to scale.</h1>
        <p className="wf-pricing-desc">
          No setup fees, no contracts. Choose the subscription that fits your team's workflow. All plans connect directly to the official Meta Cloud API.
        </p>
      </section>

      {/* Grid of pricing cards */}
      <section className="wf-pricing-grid-section wf-reveal wf-revealed">
        <div className="wf-pricing-grid">
          {plans.map((plan, index) => (
            <article
              key={plan.name}
              className={`wf-pricing-card ${plan.featured ? 'wf-pricing-card--featured' : ''}`}
              style={{ transitionDelay: `${0.1 + index * 0.08}s` }}
            >
              {plan.featured && <div className="wf-featured-ribbon">Most Popular</div>}
              
              <div className="wf-pricing-card-header">
                <h3 className="wf-pricing-card-tier">{plan.name}</h3>
                <p className="wf-pricing-card-price">
                  {plan.price}
                  {plan.price !== '$0' && <span className="wf-pricing-period">/mo</span>}
                </p>
                <span className="wf-pricing-period-sub">{plan.price === '$0' ? 'Free forever' : 'per month'}</span>
                <p className="wf-pricing-card-desc">{plan.desc}</p>
              </div>

              <hr className="wf-pricing-divider" />

              <ul className="wf-pricing-card-features">
                {plan.features.map((feature) => (
                  <li key={feature} className="wf-pricing-feature-item">
                    <svg className="wf-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="#EAF9E2" />
                      <path d="M8 12.5L11 15.5L16 9.5" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`wf-btn ${plan.featured ? 'wf-btn-primary' : 'wf-btn-outline'} wf-pricing-card-cta`}
              >
                {plan.ctaText}
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Interactive Chat Bubble FAQs */}
      <section className="wf-faq-chat-section wf-reveal wf-revealed">
        <div className="wf-faq-chat-header">
          <h2>Pricing Questions?</h2>
          <p>We answered our most common questions in a conversation format below.</p>
        </div>

        <div className="wf-faq-chat-container">
          <div className="wf-faq-chat-thread">
            {/* QA 1 */}
            <div className="wf-faq-chat-pair">
              <ChatBubble
                sender="Visitor"
                text="Is WhatFlow a Meta product or does it operate separately?"
                time="10:00 AM"
                direction="in"
                className="wf-faq-bubble-in"
              />
              <ChatBubble
                sender="WhatFlow"
                text="WhatFlow is an independent company. We operate separately from Meta Platforms, Inc. However, we are an official Meta Business Partner and WhatsApp Business Solution Provider (BSP), meaning we build directly on the official Meta Cloud APIs."
                time="10:01 AM"
                direction="out"
                className="wf-faq-bubble-out"
              />
            </div>

            {/* QA 2 */}
            <div className="wf-faq-chat-pair">
              <ChatBubble
                sender="Visitor"
                text="How do WhatsApp conversation charges work?"
                time="10:02 AM"
                direction="in"
                className="wf-faq-bubble-in"
              />
              <ChatBubble
                sender="WhatFlow"
                text="Meta charges directly for 24-hour conversation windows based on the category (Utility, Marketing, Service). WhatFlow does not add any markups to these official Meta fees. Plus, Meta gives every business 1,000 free service conversations per month!"
                time="10:03 AM"
                direction="out"
                className="wf-faq-bubble-out"
              />
            </div>

            {/* QA 3 */}
            <div className="wf-faq-chat-pair">
              <ChatBubble
                sender="Visitor"
                text="Are there any setup fees or hidden charges?"
                time="10:04 AM"
                direction="in"
                className="wf-faq-bubble-in"
              />
              <ChatBubble
                sender="WhatFlow"
                text="No setup fees or hidden costs at all. You only pay your WhatFlow flat monthly subscription and any conversation API usage fees directly to Meta."
                time="10:05 AM"
                direction="out"
                className="wf-faq-bubble-out"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
