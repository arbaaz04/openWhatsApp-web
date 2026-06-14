import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Free',
    price: 'Free to Install',
    features: [
      'Automated Order Fulfillment Alerts',
      'Custom WhatsApp Message Templates',
      'Template Library with Quick Setup',
      'WhatsApp Chat Button for Storefront',
      'Meta Business API Integration',
      'Live Delivery & Read Rate Analytics',
      'WhatsApp Order Confirmations',
      'Smart Auto-Reply Rules',
    ],
  },
  {
    name: 'Starter',
    price: '$4.99 / month',
    features: [
      'Automated Order Fulfillment Alerts',
      'Custom WhatsApp Message Templates',
      'Template Library with Quick Setup',
      'WhatsApp Chat Button for Storefront',
      'Meta Business API Integration',
      'Live Delivery & Read Rate Analytics',
      'WhatsApp Order Confirmations',
      'Smart Auto-Reply Rules',
    ],
  },
  {
    name: 'Growth',
    price: '$14.99 / month',
    features: [
      'Automated Order Fulfillment Alerts',
      'Custom WhatsApp Message Templates',
      'Template Library with Quick Setup',
      'WhatsApp Chat Button for Storefront',
      'Meta Business API Integration',
      'Live Delivery & Read Rate Analytics',
      'WhatsApp Order Confirmations',
      'Smart Auto-Reply Rules',
    ],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '$24.99 / month',
    features: [
      'WhatsApp Order Confirmations',
      'Automated Order Fulfillment Alerts',
      'Custom WhatsApp Message Templates',
      'Template Library with Quick Setup',
      'WhatsApp Chat Button for Storefront',
      'Smart Auto-Reply Rules',
      'Meta Business API Integration',
      'Live Delivery & Read Rate Analytics',
    ],
  },
];

export default function Pricing() {
  return (
    <main className="wf-pricing-page">
      <section className="wf-pricing-hero wf-reveal wf-revealed">
        <div className="wf-pricing-hero-copy">
          <h1 className="wf-hero-title">WhatsApp automation pricing designed to scale with your business.</h1>
          <p className="wf-hero-sub">
            Compare plans built for every stage of growth—from free install and starter workflows to fully-supported enterprise automation across WhatsApp commerce, delivery, and customer service.
          </p>
        </div>
      </section>

      <section id="plans" className="wf-pricing-grid-section wf-reveal wf-revealed">
        <div className="wf-pricing-grid">
          {plans.map((plan, index) => (
            <article
              key={plan.name}
              className={`wf-pricing-card wf-reveal${plan.featured ? ' wf-pricing-card--featured' : ''}`}
              style={{ transitionDelay: `${0.1 + index * 0.08}s` }}
            >
              <div className="wf-pricing-card-header">
                <p className="wf-pricing-card-tier">{plan.name}</p>
                {plan.featured && <span className="wf-pricing-card-tag">Most popular</span>}
                <p className="wf-pricing-card-price">{plan.price}</p>
              </div>
              <ul className="wf-pricing-card-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <a href="https://app.whatflow.io" className="wf-btn wf-btn-primary wf-pricing-card-cta">
                Start {plan.name}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="wf-pricing-note wf-reveal wf-revealed">
        <p>
          Every plan includes WhatsApp Business API integration, real-time delivery and read analytics, and a smart automation engine for order confirmations and fulfillment workflows.
        </p>
      </section>
    </main>
  );
}
