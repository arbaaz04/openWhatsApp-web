import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="wf-doc-container wf-reveal wf-revealed">
      <div className="wf-doc-header">
        <h1>Privacy Policy</h1>
        <p className="wf-doc-date">Last Updated: June 14, 2026</p>
      </div>
      <div className="wf-doc-content">
        <p>
          Welcome to WhatFlow ("we," "us," "our"). We provide a platform (the "Platform") that enables registered individuals and teams ("Users," "you," "your") to build, integrate, deploy, and manage WhatsApp-based software, automations, and messaging experiences. Users may use the Platform individually or as part of an organization.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, disclose, and protect information, including Personal Data, in connection with the Platform. It specifically addresses the data processed when Users use our Platform and the resulting storage of WhatsApp messages exchanged between a User's business, product, or service and End-Users.
        </p>

        <h2>1. Definitions</h2>
        <ul>
          <li><strong>Platform:</strong> Our website, applications, APIs, tools, and services operated by WhatFlow that allow Users to build, integrate, deploy, and manage WhatsApp functionality.</li>
          <li><strong>User:</strong> An individual or entity registered to use our Platform, potentially as part of an organization.</li>
          <li><strong>WhatsApp Integration:</strong> A User-created application, integration, automation, workflow, or messaging experience configured on our Platform to interact via WhatsApp.</li>
          <li><strong>End-User:</strong> An individual interacting via WhatsApp with a User's business, product, or service through a WhatsApp Integration.</li>
          <li><strong>WhatsApp Messages:</strong> The content, metadata (such as sender/recipient identifiers and timestamps), and any attachments exchanged via WhatsApp between an End-User and a User's business, product, or service through our Platform.</li>
          <li><strong>Personal Data:</strong> Any information relating to an identified or identifiable natural person.</li>
          <li><strong>User Data:</strong> Information provided by Users when they register for or use our Platform (for example, name, email, company details, account associations, and usage data).</li>
          <li><strong>End-User Data:</strong> Primarily the WhatsApp Messages processed and stored by our Platform on behalf of the User.</li>
        </ul>

        <h2>2. Information We Collect</h2>
        <h3>a. User Data</h3>
        <ul>
          <li><strong>Account Information:</strong> When you register, we collect your name, email address, password, company name (if applicable), and billing or payment details when required.</li>
          <li><strong>Usage Information:</strong> We collect data about how you and authorized users on your account use the Platform, including features accessed, API calls, connected phone numbers, templates, webhook and workflow configurations, performance metrics, IP addresses, browser type, operating system, and log data.</li>
          <li><strong>Communication Information:</strong> If you contact us for support or other inquiries, we collect the content of those communications, including email, chat, and support requests.</li>
        </ul>

        <h3>b. End-User Data (Processed on behalf of Users)</h3>
        <ul>
          <li><strong>WhatsApp Messages:</strong> When an End-User interacts with a User's business, product, or service via WhatsApp through our Platform, we receive and process the WhatsApp Messages exchanged.</li>
          <li><strong>Stored Conversation Data:</strong> We store WhatsApp Messages (including message content, sender/recipient identifiers, and timestamps) on our systems to enable messaging functionality, automation workflows, and conversation history for authorized users on the account.</li>
        </ul>

        <h2>3. How We Use Information</h2>
        <h3>a. To Provide and Improve the Platform</h3>
        <ul>
          <li>Operate, maintain, secure, and provide the features and functionality of the Platform, including messaging APIs, onboarding flows, webhooks, automations, and collaboration tools.</li>
          <li>Process and store WhatsApp Messages to enable WhatsApp functionality and provide conversation history access to authorized users on the account.</li>
          <li>Authenticate Users and manage access permissions within accounts.</li>
          <li>Process payments and billing where applicable.</li>
          <li>Monitor and analyze usage patterns to improve performance, security, developer tooling, features, and user experience.</li>
          <li>Diagnose technical issues and provide customer support.</li>
        </ul>

        <h3>b. Communication</h3>
        <ul>
          <li>Communicate with Users about account activity, Platform updates, security alerts, and support messages.</li>
          <li>Send marketing communications where permitted by law and with options to opt out.</li>
        </ul>

        <h3>c. Compliance and Safety</h3>
        <ul>
          <li>Enforce our Terms of Service and other agreements.</li>
          <li>Comply with legal obligations and respond to lawful requests from public authorities.</li>
          <li>Protect the rights, property, or safety of WhatFlow, our Users, End-Users, or the public.</li>
        </ul>

        <h2>4. Our Role as Data Processor</h2>
        <p><strong>User as Controller:</strong> For WhatsApp Messages exchanged between End-Users and a User's business, product, or service through the Platform, the User (or the organization the User represents) is the Data Controller. The User determines the purposes and means of processing this End-User Data and is responsible for ensuring a valid legal basis for processing such messages.</p>
        <p><strong>WhatFlow as Processor:</strong> We act as a Data Processor on behalf of the User for these WhatsApp Messages. We process and store this data based on the User's instructions as configured through their use of the Platform and our contractual agreement with the User. Our processing activities are limited to providing the Platform's functionality, including support for messaging workflows, automations, integrations, and storing conversation history for the User and authorized account members.</p>
        <p><strong>WhatFlow as Controller:</strong> We are the Data Controller for the User Data we collect directly from Users, including account information, usage data, communications, and related administrative records.</p>

        <h2>5. Data Sharing and Disclosure</h2>
        <p>We do not sell your Personal Data. We may share information only in the following circumstances:</p>
        <ul>
          <li><strong>Within User Accounts:</strong> Information associated with a specific account or workspace, including stored WhatsApp Messages, is accessible to authorized users on that account as managed by account administrators.</li>
          <li><strong>Service Providers:</strong> We may share information with third-party vendors and service providers who perform services on our behalf, such as cloud hosting providers, payment processors, analytics providers, and customer support tools. These providers are contractually obligated to protect the data and use it only for the services they provide.</li>
          <li><strong>Legal Requirements:</strong> We may disclose information if required by law, subpoena, or other legal process, or if we believe disclosure is necessary to protect our rights, safety, or that of others.</li>
          <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or part of our assets, information may be transferred as part of that transaction, subject to standard confidentiality arrangements.</li>
          <li><strong>Aggregated or Anonymized Data:</strong> We may share information that has been aggregated or anonymized and does not directly identify individuals for research, analytics, or other purposes.</li>
        </ul>

        <h2>6. Data Storage, Security, and Retention</h2>
        <p>Your information, including User Data and stored WhatsApp Messages, is primarily processed and stored on infrastructure provided by our cloud and hosting providers. This may involve servers located in various regions, including the United States and Europe.</p>
        <p>We implement technical and organizational security measures designed to protect information against accidental or unlawful destruction, loss, alteration, unauthorized disclosure, or access. These measures include:</p>
        <ul>
          <li>Encryption of data in transit using HTTPS/TLS.</li>
          <li>Encryption of data at rest where supported by our infrastructure providers.</li>
          <li>Authentication mechanisms for User access control.</li>
          <li>Secure physical and network security provided by our hosting partners.</li>
          <li>Regular software updates and patching of our systems.</li>
          <li>Logical separation of data where applicable.</li>
        </ul>
        <p>No security system is impenetrable, and while we strive to protect your information, we cannot guarantee absolute security.</p>
        <p>Retention:</p>
        <ul>
          <li><strong>WhatsApp Messages &amp; User Project Data:</strong> Stored for as long as the User's account remains active to provide ongoing service and historical context.</li>
          <li><strong>Account Termination:</strong> If a User terminates their account, we initiate deletion of associated User Data and stored WhatsApp Messages within a reasonable period, typically 30–90 days, unless legal obligations require longer retention.</li>
          <li><strong>User Data (Account Level):</strong> Core account information is retained while the account is active and for a reasonable period thereafter to comply with legal obligations, resolve disputes, and enforce agreements.</li>
        </ul>

        <h2>7. Data Subject Rights</h2>
        <p>Depending on your jurisdiction, you may have rights regarding the Personal Data we hold as a Controller, including:</p>
        <ul>
          <li>Access: Request access to your Personal Data.</li>
          <li>Correction: Request correction of inaccurate information.</li>
          <li>Deletion: Request deletion of your Personal Data, subject to our retention policies and legal limitations.</li>
          <li>Restriction: Request restriction of processing.</li>
          <li>Portability: Request your Personal Data in a structured, machine-readable format.</li>
          <li>Objection: Object to processing based on legitimate interests.</li>
        </ul>
        <p>To exercise these rights regarding User Data, contact us at <strong>privacy@whatflow.io</strong>. We may need to verify your identity before processing requests.</p>
        <p>End-User Data: End-Users wishing to exercise rights concerning WhatsApp Messages processed by a User's business should direct requests to the User (the Data Controller). We will assist Users as required by law and our contractual agreements.</p>

        <h2>8. International Data Transfers</h2>
        <p>Your information may be transferred to, stored, and processed in countries other than your own, including the United States and locations within the European Union. These countries may have different data protection laws than your home jurisdiction. We take steps designed to ensure an adequate level of protection, such as contractual safeguards where required.</p>

        <h2>9. Children's Privacy</h2>
        <p>The Platform is not intended for individuals under the age of 16 (or a higher local age threshold). We do not knowingly collect Personal Data from children. If we become aware that we have inadvertently collected such data, we will take steps to delete it.</p>

        <h2>10. Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or Platform functionality. Material changes will be communicated through our Platform and, where appropriate, by email. Your continued use of the Platform after changes constitute acceptance of the updated policy.</p>

        <h2>11. Contact Us</h2>
        <p>If you have questions about this Privacy Policy or our data practices, please contact us at <strong>privacy@whatflow.io</strong>.</p>
      </div>
      <div className="wf-doc-footer-btn">
        <Link to="/" className="wf-btn wf-btn-primary">‹ Back to Home</Link>
      </div>
    </div>
  );
}
