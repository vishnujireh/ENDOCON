/**
 * ENDOCON 2027 policies – text from the organising committee's policy document
 * (Privacy Policy, Terms & Conditions, Refund & Cancellation Policy).
 *
 * A block is a paragraph (string) or a bullet list; a bullet can carry a nested list.
 */
export type Bullet = string | { text: string; sub: string[] };
export type Block = string | { list: Bullet[] } | { heading: string };
export type LegalSection = { title: string; blocks: Block[] };
export type LegalDoc = { slug: string; title: string; short: string; intro?: string; sections: LegalSection[] };

export const CONTACT_EMAIL = 'endocon2027@gmail.com';

export const PRIVACY: LegalDoc = {
  slug: 'privacy-policy',
  title: 'Privacy Policy',
  short: 'Privacy Policy',
  sections: [
    {
      title: 'Introduction',
      blocks: [
        'ENDOCON 2027 is committed to protecting the privacy and personal information of all website visitors, registrants, delegates, faculty, sponsors, and partners. This Privacy Policy explains how information is collected, used, stored, and protected when you access the ENDOCON 2027 website or register for the conference and its associated events.',
        'By using this website or registering for ENDOCON 2027, you consent to the practices described in this Privacy Policy.',
      ],
    },
    {
      title: 'Information We Collect',
      blocks: [
        'We may collect the following categories of information:',
        { heading: 'Personal Information' },
        {
          list: [
            'Full name',
            'Professional designation and affiliation',
            'Medical registration details (if applicable)',
            'Email address and contact number',
            'Postal address (if required for certificates or correspondence)',
          ],
        },
        { heading: 'Registration & Transaction Information' },
        { list: ['Conference registration category', 'Workshops or sessions selected', 'Payment transaction reference numbers'] },
        'Note: Card and banking details are processed securely by third-party payment gateways and are not stored by ENDOCON 2027.',
        { heading: 'Technical & Usage Information' },
        { list: ['IP address', 'Browser type and device information', 'Website interaction data', 'Cookies and similar tracking technologies'] },
      ],
    },
    {
      title: 'Purpose of Data Collection',
      blocks: [
        'Your information may be used for the following purposes:',
        {
          list: [
            'Processing conference registrations and payments',
            'Issuing confirmations, badges and certificates',
            'Communicating important event updates and announcements',
            'Managing workshops, scientific sessions and logistics',
            'Compliance with regulatory or accreditation requirements',
            'Internal reporting, analytics and service improvement',
          ],
        },
      ],
    },
    {
      title: 'Data Storage & Security',
      blocks: [
        {
          list: [
            'All personal information is stored securely and accessed only by authorized personnel.',
            'Appropriate administrative, technical and physical safeguards are implemented to protect data against unauthorized access, loss or misuse.',
            'Payment transactions are processed through PCI-DSS compliant third-party payment gateways using encrypted connections.',
          ],
        },
      ],
    },
    {
      title: 'Data Sharing & Disclosure',
      blocks: [
        'ENDOCON 2027 does not sell, rent or trade personal information.',
        'Information may be shared only with:',
        {
          list: [
            'Event management partners',
            'Accreditation bodies or professional councils (if required)',
            'Government or legal authorities when mandated by law',
            'Payment gateway providers for transaction processing',
          ],
        },
        'All third parties are required to maintain confidentiality and data protection standards.',
      ],
    },
    {
      title: 'Communication & Consent',
      blocks: [
        'By registering for ENDOCON 2027, you consent to receive:',
        { list: ['Registration confirmations', 'Program updates and logistical information', 'Important notifications related to the conference'] },
        'You may opt out of non-essential or promotional communications at any time.',
      ],
    },
    {
      title: 'Photography, Video & Media',
      blocks: [
        {
          list: [
            'Photographs, videos and recordings may be captured during ENDOCON 2027 for academic, documentation and promotional purposes.',
            'By attending the event, participants consent to the use of such media without entitlement to compensation.',
            'Personal identification will not be disclosed inappropriately.',
          ],
        },
      ],
    },
    {
      title: 'Cookies Policy',
      blocks: [
        {
          list: [
            'The ENDOCON 2027 website may use cookies to enhance user experience and analyse website traffic.',
            'Cookies do not collect personally identifiable information.',
            'Users may disable cookies through browser settings; however, some website features may be limited.',
          ],
        },
      ],
    },
    {
      title: 'Data Retention',
      blocks: [
        {
          list: [
            'Personal information is retained only for as long as necessary to fulfil the purposes outlined in this policy or as required by law.',
            'Data may be archived for record-keeping, audit or compliance purposes.',
          ],
        },
      ],
    },
    {
      title: 'User Rights',
      blocks: [
        'Users have the right to:',
        {
          list: [
            'Access their personal information',
            'Request correction of inaccurate data',
            'Request deletion of data, subject to legal and operational requirements',
            'Withdraw consent for data usage (where applicable)',
          ],
        },
        'Requests may be submitted via the official ENDOCON 2027 contact email.',
      ],
    },
    {
      title: 'External Links',
      blocks: [
        'The ENDOCON 2027 website may contain links to third-party websites. ENDOCON 2027 is not responsible for the privacy practices or content of external sites. Users are encouraged to review the privacy policies of such websites independently.',
      ],
    },
    {
      title: 'Policy Updates',
      blocks: [
        'ENDOCON 2027 reserves the right to update or modify this Privacy Policy at any time. Changes will be effective upon posting on the website.',
        'Continued use of the website after changes indicates acceptance of the updated policy.',
      ],
    },
    {
      title: 'Contact Information',
      blocks: ['For any queries or concerns regarding this Privacy Policy or the handling of personal data, please contact the ENDOCON 2027 Organizing Committee.'],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: 'terms-and-conditions',
  title: 'Terms & Conditions',
  short: 'Terms & Conditions',
  sections: [
    {
      title: 'General',
      blocks: [
        'These Terms & Conditions govern access to and use of the ENDOCON 2027 website and participation in the conference, workshops, exhibitions and associated events. By registering for or attending ENDOCON 2027, the delegate agrees to comply with these Terms & Conditions in full.',
        'ENDOCON 2027 is a professional medical conference intended solely for healthcare professionals, industry partners, exhibitors, sponsors and invited participants.',
      ],
    },
    {
      title: 'Registration & Participation',
      blocks: [
        {
          list: [
            'Registration is mandatory for all participants.',
            'Registration is considered valid only upon successful completion of payment and confirmation.',
            'The Organizing Committee reserves the right to accept or reject any registration without assigning any reason.',
            'Registration is personal and non-transferable under any circumstances.',
            'Any incorrect, false or misleading information provided during registration may lead to cancellation of registration without refund.',
          ],
        },
      ],
    },
    {
      title: 'Payment & Financial Terms',
      blocks: [
        {
          list: [
            'All payments must be made through the official online payment gateway authorized by ENDOCON 2027.',
            'Registration fees are subject to applicable taxes, including GST, as per prevailing government regulations.',
            {
              text: 'The Organizing Committee is not responsible for:',
              sub: [
                'Failed transactions',
                'Duplicate payments',
                'Banking or gateway-related technical issues (Such issues must be resolved directly with the respective bank or payment service provider.)',
              ],
            },
            'ENDOCON 2027 does not store or process participants’ card or banking details.',
            'Refunds, cancellations and related matters shall be governed strictly by the official Refund & Cancellation Policy of ENDOCON 2027.',
          ],
        },
      ],
    },
    {
      title: 'Confirmation & Communication',
      blocks: [
        {
          list: [
            'Upon successful registration, a confirmation email will be sent to the registered email address.',
            'It is the responsibility of the participant to ensure that correct contact details are provided.',
            'All official communication related to ENDOCON 2027 shall be made via email, website announcements or authorized messaging channels.',
          ],
        },
      ],
    },
    {
      title: 'Conference Program & Event Changes',
      blocks: [
        {
          list: [
            {
              text: 'The Organizing Committee reserves the right to:',
              sub: ['Modify the scientific program.', 'Change speakers, topics, schedule, venue or format.', 'Postpone, reschedule or cancel the event partially or entirely.'],
            },
            'Such changes shall not entitle participants to claim compensation or damages.',
          ],
        },
      ],
    },
    {
      title: 'Code of Conduct',
      blocks: [
        {
          list: [
            'ENDOCON 2027 is committed to maintaining a respectful, inclusive and professional environment.',
            {
              text: 'Any form of misconduct, harassment, abuse or disruptive behaviour may result in:',
              sub: ['Immediate removal from the event', 'Cancellation of registration', 'Denial of future participation without entitlement to any refund.'],
            },
          ],
        },
      ],
    },
    {
      title: 'Intellectual Property & Usage',
      blocks: [
        {
          list: [
            'All conference content, including presentations, abstracts, videos, photographs and materials is protected by intellectual property laws.',
            'Audio/video recording, photography, reproduction or distribution of content without prior written permission from the Organizing Committee is strictly prohibited.',
            'The Organizing Committee reserves the right to record sessions and publish such recordings on social media platforms and/or in academic journals for educational and promotional purposes.',
          ],
        },
      ],
    },
    {
      title: 'Photography & Media Consent',
      blocks: [
        'By attending ENDOCON 2027, participants grant permission to the Organizing Committee to:',
        {
          list: [
            'Capture photographs, videos or recordings during the event',
            'Use such material for educational, promotional and archival purposes without compensation',
          ],
        },
      ],
    },
    {
      title: 'Liability & Disclaimer',
      blocks: [
        {
          list: [
            {
              text: 'ENDOCON 2027 and its Organizing Committee shall not be liable for:',
              sub: ['Personal injury, illness or loss', 'Theft or damage to personal belongings', 'Travel, accommodation, visa or transportation issues'],
            },
            'Participants are advised to arrange their own travel, medical and personal insurance.',
            'The Organizing Committee shall not be liable for any additional compensation beyond the registration fee paid. The event may be postponed, rescheduled or converted to a virtual format.',
          ],
        },
      ],
    },
    {
      title: 'Force Majeure',
      blocks: [
        'In the event of circumstances beyond the control of the Organizing Committee, including but not limited to:',
        { list: ['Natural disasters', 'Pandemics or epidemics', 'Government restrictions or advisories', 'Acts of God, strikes or technical failures'] },
        'The Organizing Committee shall not be liable for any additional compensation beyond the registration fee paid. The event may be postponed, rescheduled or converted to a virtual format.',
      ],
    },
    {
      title: 'Governing Law & Jurisdiction',
      blocks: [
        {
          list: [
            'These Terms & Conditions shall be governed by and interpreted in accordance with the laws of India.',
            'Any disputes arising shall be subject to the exclusive jurisdiction of the Kolkata courts in India.',
          ],
        },
      ],
    },
    {
      title: 'Acceptance of Terms',
      blocks: [
        'By accessing the website or registering for ENDOCON 2027, the participant acknowledges that they have read, understood and agreed to abide by these Terms & Conditions.',
      ],
    },
  ],
};

export const REFUND: LegalDoc = {
  slug: 'refund-and-cancellation-policy',
  title: 'Refund & Cancellation Policy',
  short: 'Refund & Cancellation',
  sections: [
    {
      title: 'General',
      blocks: [
        'This Refund & Cancellation Policy applies to all registrations made for ENDOCON 2027, including conference registration, workshops and associated events. By registering for ENDOCON 2027, participants agree to abide by the terms outlined below.',
      ],
    },
    {
      title: 'Cancellation Procedure',
      blocks: [
        {
          list: [
            `All cancellation requests must be submitted in writing via email to the Conference Secretariat at ${CONTACT_EMAIL}, along with payment details and the invoice and/or receipt copy to facilitate verification and processing.`,
            'Cancellation requests submitted via telephone, WhatsApp or verbal communication will not be considered valid.',
            'The date of receipt of the email by the Organizing Committee shall be considered the official date of cancellation.',
            'The subject line of the email must clearly mention: “Cancellation and Refund Request”',
          ],
        },
      ],
    },
    {
      title: 'Refund Eligibility & Timeline',
      blocks: [
        { heading: '3.1 Cancellation by Participant' },
        {
          list: [
            'Cancellation requests received on or before 25th March, 2027 (11:59 PM IST) will be eligible for a refund of 75% of the registration fee.',
            'Cancellation requests received after 25th March, 2027 (11:59 PM IST) will not be eligible for any refund under any circumstances.',
          ],
        },
      ],
    },
    {
      title: 'Refund Amount & Deductions',
      blocks: [
        {
          list: [
            { text: 'Approved refunds shall be processed after deducting:', sub: ['Applicable GST', 'Payment gateway / bank charges', 'Administrative processing fees'] },
            'Except as expressly provided in this policy, registration fees are non-refundable and non-transferable under all circumstances.',
          ],
        },
      ],
    },
    {
      title: 'No-Show Policy',
      blocks: [
        {
          list: [
            'Participants who do not attend the conference without prior written cancellation will be treated as No-Shows.',
            'No refund shall be provided for No-Shows under any circumstances.',
          ],
        },
      ],
    },
    {
      title: 'Processing of Refunds',
      blocks: [
        {
          list: [
            'All eligible refunds will be processed within 30–45 working days after the conclusion of the conference.',
            'Refunds will be credited to the original mode of payment wherever technically feasible. In exceptional cases where gateway reversal is not possible, refunds may be processed by the Organizing Committee’s accounts department via NEFT/RTGS transfer, subject to verification of payment details, registration records and eligibility criteria under this policy.',
            'Delegates must provide accurate bank details, along with payment details and the invoice/receipt copy, from their registered email ID to facilitate processing.',
            'ENDOCON 2027 shall not be responsible for delays arising from banking systems, payment gateway processing timelines or incorrect information provided by the delegate.',
            'All refunds shall be processed strictly in accordance with this Refund & Cancellation Policy.',
            'Any chargeback, payment dispute or reversal initiated without prior written communication with the Organizing Committee shall be treated as a violation of this policy and may result in forfeiture of eligibility for refund processing.',
          ],
        },
      ],
    },
    {
      title: 'Event Modification or Cancellation by Organizers',
      blocks: [
        'The Organizing Committee reserves the right to:',
        { list: ['Modify the program, schedule or format of the event', 'Postpone, reschedule or cancel the event in part or in full due to unavoidable circumstances'] },
        'In such cases:',
        {
          list: [
            'Refunds, if applicable, shall be decided at the sole discretion of the Organizing Committee and such decision shall be final and binding.',
            'Liability shall be limited strictly to the amount of the registration fee paid.',
          ],
        },
      ],
    },
    {
      title: 'Force Majeure',
      blocks: [
        'In the event of circumstances beyond the control of the Organizing Committee, including but not limited to:',
        { list: ['Natural disasters', 'Pandemics or epidemics', 'Government restrictions or advisories', 'Acts of God, strikes or technical failures'] },
        'The Organizing Committee shall not be liable for any additional compensation beyond the registration fee paid. The event may be postponed, rescheduled or converted to a virtual format.',
      ],
    },
    {
      title: 'Contact for Cancellation & Refunds',
      blocks: ['All refund and cancellation-related communications must be addressed to the ENDOCON 2027 Organizing Committee.'],
    },
  ],
};

export const LEGAL_DOCS = [PRIVACY, TERMS, REFUND];
