-- Agent Studio policy for the fictional demo organisation (run after demo-business.sql and
-- migration 0005). Fictional facts only. Safe to run more than once: it does nothing if the demo's
-- front desk already has procedures.

do $$
declare
  t uuid;
  front uuid;
  profile jsonb := jsonb_build_object(
    'summary', 'Bright Smile Dental is a fictional family dental practice with three dentists.',
    'timezone', 'Europe/Lisbon',
    'hours', jsonb_build_object(
      'mon', jsonb_build_object('open', '08:30', 'close', '17:30'),
      'tue', jsonb_build_object('open', '08:30', 'close', '17:30'),
      'wed', jsonb_build_object('open', '08:30', 'close', '17:30'),
      'thu', jsonb_build_object('open', '08:30', 'close', '19:00'),
      'fri', jsonb_build_object('open', '08:30', 'close', '17:30'),
      'sat', jsonb_build_object('open', '09:00', 'close', '13:00'),
      'sun', null),
    'services', jsonb_build_array(
      jsonb_build_object('name', 'Check-up and clean', 'price', '65 EUR', 'duration', '30 min'),
      jsonb_build_object('name', 'Teeth whitening', 'price', '250 EUR', 'duration', '60 min'),
      jsonb_build_object('name', 'Filling', 'price', 'from 80 EUR', 'duration', '45 min'),
      jsonb_build_object('name', 'Emergency visit', 'price', '90 EUR', 'duration', '30 min')),
    'locations', jsonb_build_array(jsonb_build_object('address', '12 Example Street (fictional)')),
    'faqs', jsonb_build_array(
      jsonb_build_object('question', 'Is there parking?', 'answer', 'Yes, free parking behind the building.'),
      jsonb_build_object('question', 'Do you take new patients?', 'answer', 'Yes. Please bring ID and any previous X-rays.'),
      jsonb_build_object('question', 'How can I pay?', 'answer', 'Card or cash.')),
    'other', '');
  rules jsonb;
  procedures jsonb;
  limits jsonb := jsonb_build_object(
    'maxDiscountPercent', 0, 'bookingWindowDays', 60, 'minNoticeHours', 4,
    'cancellationNoticeHours', 24, 'afterHours', 'take_message',
    'blockedTopics', jsonb_build_array('insurance claims', 'diagnosis'),
    'handoffContact', 'the reception team', 'handoffWhen', jsonb_build_array('asked', 'frustrated', 'loop'),
    'tone', 'friendly', 'replyLength', 'short');
begin
  select id into t from public.tenants where slug = 'bright-smile-demo';
  if t is null then raise notice 'run demo-business.sql first'; return; end if;
  select id into front from public.agents where tenant_id = t and name = 'Front desk';
  if exists (select 1 from public.agent_procedures where agent_id = front) then
    raise notice 'demo studio already exists'; return;
  end if;

  insert into public.business_profiles (tenant_id, profile) values (t, profile)
    on conflict (tenant_id) do update set profile = excluded.profile, updated_at = now();

  insert into public.agent_rules (tenant_id, agent_id, text, scope, priority) values
    (t, front, 'For pain or swelling, offer the earliest emergency visit and say a dentist will call back if needed.', '{}', 5),
    (t, front, 'Mention that new patients should bring ID and previous X-rays when they book.', '{"callers": "new"}', 0),
    (t, front, 'On the phone, keep answers to two short sentences.', '{"channels": ["voice"]}', 0);

  insert into public.agent_procedures (tenant_id, agent_id, template, name, when_to_use, when_not_to_use, required_info, steps, confirm_before_acting) values
    (t, front, 'book', 'Book a visit', 'The patient wants a new appointment.', 'They want to move or cancel one.',
      '[{"key":"name","label":"Full name","type":"text"},{"key":"phone","label":"Phone number","type":"phone"},{"key":"service","label":"Service","type":"text"},{"key":"date","label":"Preferred day","type":"date"},{"key":"time","label":"Preferred time","type":"time"}]',
      array['Ask which service they need.', 'Ask for a day and time within opening hours.', 'Ask for their name and phone number.', 'Read the details back and ask them to confirm.'], true),
    (t, front, 'cancel', 'Cancel a visit', 'The patient wants to cancel an appointment.', 'They only want to move it.',
      '[{"key":"name","label":"Full name","type":"text"},{"key":"phone","label":"Phone number","type":"phone"},{"key":"current","label":"Appointment to cancel","type":"text"}]',
      array['Find the appointment.', 'Offer to move it instead.', 'If they still want to cancel, confirm.'], true),
    (t, front, 'message', 'Take a message', 'The patient wants a callback or to leave a message.', 'The facts answer the question.',
      '[{"key":"name","label":"Full name","type":"text"},{"key":"phone","label":"Phone number","type":"phone"},{"key":"message","label":"Message","type":"text"}]',
      array['Ask for their name, number and a short message.', 'Say the team will call back the next working day.'], false),
    (t, front, 'transfer', 'Pass to a person', 'A complaint, a complex case, or they ask for a person.', 'A procedure or the facts can handle it.',
      '[{"key":"name","label":"Full name","type":"text"},{"key":"phone","label":"Phone number","type":"phone"}]',
      array['Apologise if needed.', 'Take their name and number.', 'Say a person will follow up today.'], false);

  insert into public.agent_limits (agent_id, tenant_id, max_discount_percent, booking_window_days, min_notice_hours,
    cancellation_notice_hours, after_hours, blocked_topics, handoff_contact, tone, reply_length)
  values (front, t, 0, 60, 4, 24, 'take_message', array['insurance claims', 'diagnosis'], 'the reception team', 'friendly', 'short');

  -- Publish: the snapshot the live agent runs with.
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'text', text, 'scope', scope, 'priority', priority, 'enabled', enabled,
    'updatedAt', updated_at)), '[]') into rules from public.agent_rules where agent_id = front and enabled;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'template', template, 'name', name, 'whenToUse', when_to_use,
    'whenNotToUse', when_not_to_use, 'requiredInfo', required_info, 'steps', to_jsonb(steps),
    'confirmBeforeActing', confirm_before_acting, 'enabled', enabled) order by created_at), '[]')
    into procedures from public.agent_procedures where agent_id = front and enabled;
  update public.agents set config = jsonb_build_object('version', 2, 'profile', profile, 'rules', rules,
    'procedures', procedures, 'limits', limits) where id = front;
  insert into public.agent_settings_versions (agent_id, tenant_id, settings, published_at)
    select id, tenant_id, config, now() from public.agents where id = front;

  insert into public.policy_changes (tenant_id, agent_id, object_type, action, note) values
    (t, front, 'profile', 'create', 'Demo facts: hours, prices, FAQs'),
    (t, front, 'rule', 'create', 'Demo rules'),
    (t, front, 'procedure', 'create', 'Demo procedures: book, cancel, message, transfer'),
    (t, front, 'limits', 'create', 'Demo limits: 4h notice, 60 days ahead, no discounts'),
    (t, front, 'publish', 'publish', 'First Studio version (demo)');
end $$;
