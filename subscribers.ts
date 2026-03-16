'use server';

import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type Subscriber = {
  id: number;
  email: string;
  lang: string;
  created_at: string;
};

export type EmailContent = {
  subject: string;
  htmlBody: string;
};

export async function getSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscribers:', error);
    return [];
  }
  return data as Subscriber[];
}

export async function deleteSubscriber(id: number) {
  const { error } = await supabase.from('subscribers').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function sendBulkEmail(
  contentEn: EmailContent,
  contentUk: EmailContent,
  target: 'all' | 'uk' | 'en'
) {
  const subscribers = await getSubscribers();

  if (!subscribers?.length) {
    return { success: false, message: 'No subscribers found' };
  }

  const recipients = subscribers.filter((sub) => {
    if (target === 'all') return true;
    if (target === 'uk') return sub.lang === 'uk';
    return sub.lang !== 'uk';
  });

  if (!recipients.length) {
    return { success: false, message: 'No subscribers for the selected audience' };
  }

  let sentCount = 0;
  let errorCount = 0;

  const promises = recipients.map((sub) => {
    const isUk = sub.lang === 'uk';
    const emailData = target === 'all' 
      ? (isUk ? contentUk : contentEn) 
      : (target === 'uk' ? contentUk : contentEn);

    const msg = {
      to: sub.email,
      from: {
        email: 'info@madedge.net',
        name: isUk ? 'MadEdge Україна' : 'MadEdge Global',
      },
      subject: emailData.subject || 'MadEdge News',
      html: emailData.htmlBody || '<p>News from MadEdge</p>',
    };

    return sgMail
      .send(msg)
      .then(() => ({ status: 'fulfilled', email: sub.email }))
      .catch((err) => ({ status: 'rejected', email: sub.email, reason: err }));
  });

  const results = await Promise.all(promises);

  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      sentCount++;
    } else {
      errorCount++;
      console.error(`Failed to send to ${res.email}:`, res.reason);
    }
  });

  return {
    success: true,
    message: `Sent: ${sentCount}, Errors: ${errorCount}`,
  };
}
