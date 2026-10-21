-- Demo organisation for showing and checking the portal. Entirely fictional: no real people,
-- numbers or emails. Safe to run more than once (it does nothing if the demo already exists).
-- Run in the Supabase SQL editor after migration 0004.

do $$
declare
  t uuid;
  front uuid;
  quotes uuid;
  c uuid;
  i int;
  rec record;
begin
  if exists (select 1 from public.tenants where slug = 'bright-smile-demo') then
    raise notice 'demo already exists';
    return;
  end if;

  insert into public.tenants (name, slug, plan, seat_limit, agent_limit, ai_monthly_budget_micros)
  values ('Bright Smile Dental (demo)', 'bright-smile-demo', 'growth', 10, 3, 2000000)
  returning id into t;

  insert into public.agents (tenant_id, name, type, status, config) values
    (t, 'Front desk', 'receptionist', 'live', jsonb_build_object(
      'greeting', 'Hi, thanks for contacting Bright Smile Dental. How can I help?',
      'businessFacts', E'Open Monday to Friday 08:30-17:30, Saturday 09:00-13:00, closed Sunday.\nCheck-up and clean: 65 EUR (30 minutes). Teeth whitening: 250 EUR. Emergency visits same day when possible.\nAddress: 12 Example Street (fictional). We accept card and cash.\nNew patients welcome; bring ID and any previous X-rays.',
      'handoffContact', 'Reception team',
      'tone', 'friendly'))
    returning id into front;
  insert into public.agents (tenant_id, name, type, status, config) values
    (t, 'Quotes', 'quote', 'live', jsonb_build_object(
      'businessFacts', E'Quotes for treatment plans are prepared by the dentist after a check-up. Crowns from 450 EUR, implants from 1,400 EUR.',
      'tone', 'formal'))
    returning id into quotes;

  insert into public.agent_settings_versions (agent_id, tenant_id, settings, published_at)
  select id, tenant_id, config, now() - interval '20 days' from public.agents where tenant_id = t;

  -- Fourteen days of fictional conversations.
  for rec in
    select * from (values
      (0,  'Website visitor', 'web_chat', front,  'booked',             '{}'::text[],                       '{booking}'::text[],   'Booked a check-up for Thursday 10:00.'),
      (0,  'Caller ending 41', 'voice',   front,  'handed_off',         '{needs_attention}',                '{emergency}',         'Toothache since last night; asked for a callback today.'),
      (1,  'Website visitor', 'web_chat', front,  'resolved_assumed',   '{unanswered}',                     '{parking}',           'Asked where to park; the agent had no parking information.'),
      (1,  'Website visitor', 'web_chat', front,  'resolved_assumed',   '{unanswered}',                     '{parking}',           'Asked about parking near the practice.'),
      (2,  'Caller ending 07', 'voice',   front,  'booked',             '{}',                               '{booking}',           'Booked a clean for next Monday 08:30.'),
      (2,  'Website visitor', 'web_chat', quotes, 'lead',               '{needs_attention}',                '{crown}',             'Wants a quote for a crown; left an email address.'),
      (3,  'Text message',    'sms',      front,  'resolved_confirmed', '{}',                               '{opening hours}',     'Asked Saturday opening hours; confirmed it answered.'),
      (4,  'Website visitor', 'web_chat', front,  'resolved_assumed',   '{unanswered}',                     '{whitening}',         'Asked if whitening is safe during pregnancy.'),
      (5,  'Caller ending 93', 'voice',   front,  'booked',             '{}',                               '{booking}',           'New patient booked a first check-up.'),
      (6,  'Website visitor', 'web_chat', front,  'abandoned',          '{}',                               '{prices}',            'Asked prices then left.'),
      (8,  'Website visitor', 'web_chat', front,  'booked',             '{}',                               '{booking}',           'Booked a check-up.'),
      (9,  'Caller ending 12', 'voice',   front,  'handed_off',         '{}',                               '{insurance}',         'Asked about insurance; passed to reception.'),
      (10, 'Website visitor', 'web_chat', quotes, 'lead',               '{}',                               '{implant}',           'Asked for an implant quote.'),
      (12, 'Text message',    'sms',      front,  'resolved_confirmed', '{}',                               '{opening hours}',     'Asked if open on Sunday.')
    ) as v(days_ago, label, channel, agent, outcome, flags, topics, summary)
  loop
    insert into public.conversations (tenant_id, agent_id, channel, customer_label, outcome, flags, topics,
      summary, ai_disclosed, status, started_at, ended_at)
    values (t, rec.agent, rec.channel, rec.label, rec.outcome, rec.flags, rec.topics, rec.summary, true,
      'ended', now() - make_interval(days => rec.days_ago, hours => 2), now() - make_interval(days => rec.days_ago, hours => 2) + interval '4 minutes')
    returning id into c;
    insert into public.conversation_messages (conversation_id, tenant_id, role, body, created_at) values
      (c, t, 'customer', 'Hi, ' || lower(rec.summary), now() - make_interval(days => rec.days_ago, hours => 2)),
      (c, t, 'agent', 'Hi, I''m Bright Smile Dental''s AI assistant. I''m an AI, and you can ask for a person at any time. Happy to help with that.', now() - make_interval(days => rec.days_ago, hours => 2) + interval '5 seconds');
    insert into public.agent_decisions (tenant_id, conversation_id, agent_id, decision, outcome, reason, intent,
      confidence, provider, model, input_tokens, output_tokens, cost_micros, latency_ms, created_at)
    values (t, c, rec.agent, 'route', 'ok', 'confident_match', rec.topics[1], 0.9, 'groq', 'openai/gpt-oss-120b',
      180, 20, 0, 420, now() - make_interval(days => rec.days_ago, hours => 2));
  end loop;

  -- A quote waiting for approval (tier 2).
  select id into c from public.conversations where tenant_id = t and 'crown' = any(topics) limit 1;
  insert into public.approvals (tenant_id, agent_id, conversation_id, action, risk_tier, summary, payload, payload_hash, expires_at)
  values (t, quotes, c, 'quote.send', 2, 'Send a crown quote of 450 EUR to the customer',
    '{"amount": 450, "currency": "EUR", "item": "crown"}',
    encode(sha256(convert_to('{"amount":450,"currency":"EUR","item":"crown"}', 'UTF8')), 'hex'),
    now() + interval '2 days');

  -- Usage for the month so far.
  for i in 0..13 loop
    insert into public.usage_daily (tenant_id, agent_id, day, conversations, llm_calls, input_tokens, output_tokens, cost_micros)
    values (t, front, current_date - i, 1, 2, 600, 80, 70);
  end loop;

  insert into public.audit_logs (tenant_id, actor_type, action, target_type, target_id, metadata)
  values (t, 'system', 'demo.seeded', 'tenant', t::text, '{"note": "fictional demo data"}');
end $$;
