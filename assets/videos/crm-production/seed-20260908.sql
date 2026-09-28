DO $seed$
DECLARE t bigint; c bigint; r jsonb; m jsonb; n integer; base timestamptz := now() - interval '35 minutes';
BEGIN
 SELECT id INTO STRICT t FROM tenants WHERE slug='catalogohoy-demo' AND id=1992;
 IF NOT EXISTS(SELECT 1 FROM whatsapp_accounts WHERE tenant_id=t AND status='active' AND phone_number_id IS NULL AND coalesce(access_token,'')='') THEN RAISE EXCEPTION 'Expected demo WhatsApp account'; END IF;
 IF NOT EXISTS(SELECT 1 FROM social_accounts WHERE tenant_id=t AND channel='tiktok' AND status='active' AND access_token LIKE 'DEMO-%') THEN RAISE EXCEPTION 'Expected demo TikTok account'; END IF;
 INSERT INTO pipeline_statuses(tenant_id,key,name,color,position)
 VALUES(t,'demo-video-nuevo','Nuevo','#3e7bfa',0),(t,'demo-video-seguimiento','En seguimiento','#e9a23b',1),(t,'demo-video-resuelto','Resuelto','#16a34a',2)
 ON CONFLICT(tenant_id,key) DO NOTHING;
 FOR r IN SELECT value FROM jsonb_array_elements('[
 {"key":"wa-1","name":"Alicia Méndez","channel":"whatsapp","phone":"+12025550101","minutes":4,"messages":[{"mine":false,"text":"¡Hola! Vi la camiseta azul en el catálogo. ¿La tienen en talla M?"},{"mine":true,"text":"¡Hola, Alicia! Sí, tenemos talla M disponible. ¿La prefieres para retirar o con envío?"},{"mine":false,"text":"Con envío, por favor. ¿Me ayudas a preparar el pedido?"}]},
 {"key":"tt-1","name":"Mateo Rojas","channel":"tiktok","username":"mateo.demo","minutes":8,"messages":[{"mine":false,"text":"¡Hola! Vi su video y me gustó la camiseta negra. ¿Es oversize?"},{"mine":true,"text":"¡Sí, Mateo! Es nuestro modelo streetwear oversize. Te comparto una foto."},{"mine":true,"text":"Camiseta Negra Streetwear","image":"https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/ai/bg_1781892167645_0bf96531.png"},{"mine":false,"text":"¡Esa misma! ¿Tienen talla L?"}]},
 {"key":"wa-2","name":"Lucía Torres","channel":"whatsapp","phone":"+12025550102","minutes":12,"messages":[{"mine":false,"text":"Buenos días. ¿Puedo retirar mi compra en la tienda?"},{"mine":true,"text":"¡Claro, Lucía! Podemos coordinar tu retiro desde aquí."},{"mine":false,"text":"Perfecto, paso mañana por la tarde. ¡Gracias!"}]},
 {"key":"tt-2","name":"Diego Vargas","channel":"tiktok","username":"diego.demo","minutes":16,"messages":[{"mine":false,"text":"Hola, llegué desde TikTok. ¿Dónde puedo ver los modelos disponibles?"},{"mine":true,"text":"¡Bienvenido, Diego! Puedes explorar todos los modelos en nuestro catálogo."},{"mine":false,"text":"¡Genial! Voy a revisar los colores y les escribo."}]}
 ]'::jsonb)
 LOOP
  IF EXISTS(SELECT 1 FROM chats WHERE tenant_id=t AND external_user_id='demo-crm-video-20260908-' || (r->>'key')) THEN CONTINUE; END IF;
  INSERT INTO chats(tenant_id,customer_name,customer_phone,channel,external_user_id,customer_username,tags,pipeline_status,created_at,internal_notes)
  VALUES(t,r->>'name',r->>'phone',r->>'channel','demo-crm-video-20260908-' || (r->>'key'),r->>'username',ARRAY['demo','crm-video-20260908'],'demo-video-nuevo',base,
   CASE WHEN r->>'key'='wa-1' THEN jsonb_build_array(jsonb_build_object('author','Equipo demo','text','Cliente interesada en camiseta azul, talla M. Coordinar envío.','createdAt',base)) ELSE '[]'::jsonb END) RETURNING id INTO c;
  n := 0;
  FOR m IN SELECT value FROM jsonb_array_elements(r->'messages')
  LOOP
   n:=n+1;
   INSERT INTO chat_messages(chat_id,content,is_mine,created_at,message_type,media_url,delivery_status)
   VALUES(c,m->>'text',(m->>'mine')::boolean,base+n*interval '2 minutes',CASE WHEN m ? 'image' THEN 'image' ELSE 'text' END,m->>'image',NULL);
  END LOOP;
  UPDATE chats SET last_message=(r->'messages'->-1)->>'text',last_message_at=now()-(r->>'minutes')::int*interval '1 minute',last_message_is_mine=false,unread_count=1 WHERE id=c;
 END LOOP;
END $seed$;
SELECT id,customer_name,channel,external_user_id,(SELECT count(*) FROM chat_messages WHERE chat_id=chats.id) AS messages FROM chats WHERE tenant_id=1992 AND external_user_id LIKE 'demo-crm-video-20260908-%' ORDER BY id;
