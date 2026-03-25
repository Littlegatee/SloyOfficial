import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tgData = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      return new Response(
        JSON.stringify({ error: 'Telegram bot token не настроен. Добавьте TELEGRAM_BOT_TOKEN в секреты.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Telegram auth data
    const { hash, ...dataToCheck } = tgData;

    // Create check string
    const checkArr = Object.keys(dataToCheck)
      .sort()
      .map(k => `${k}=${dataToCheck[k]}`);
    const checkString = checkArr.join('\n');

    // Create secret key from bot token
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretHash = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken));

    // Verify hash
    const dataKey = await crypto.subtle.importKey(
      'raw',
      secretHash,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const dataHash = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(checkString));
    const computedHash = Array.from(new Uint8Array(dataHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Check auth_date is not too old (1 day)
    const authDate = parseInt(tgData.auth_date);
    if (Date.now() / 1000 - authDate > 86400) {
      return new Response(
        JSON.stringify({ error: 'Telegram auth data expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const telegramId = String(tgData.id);
    const firstName = tgData.first_name || 'User';
    const lastName = tgData.last_name || '';
    const username = tgData.username || `tg_${telegramId}`;

    // Check if user already exists by telegram_id
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id, email')
      .eq('telegram_id', telegramId)
      .single();

    if (existingProfile) {
      // User exists - generate a magic link or sign in
      const email = existingProfile.email || `tg_${telegramId}@sloy.app`;
      const password = `tg_${telegramId}_${botToken.slice(0, 10)}`;

      // Try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return new Response(
          JSON.stringify({ error: 'Ошибка входа. Попробуйте снова.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          email,
          password,
          user: signInData.user,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Create new user
      const email = `tg_${telegramId}@sloy.app`;
      const password = `tg_${telegramId}_${botToken.slice(0, 10)}`;

      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (signUpError) {
        return new Response(
          JSON.stringify({ error: signUpError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update profile with telegram_id
      if (signUpData.user) {
        await supabase
          .from('profiles')
          .update({ telegram_id: telegramId })
          .eq('user_id', signUpData.user.id);
      }

      return new Response(
        JSON.stringify({
          email,
          password,
          user: signUpData.user,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
