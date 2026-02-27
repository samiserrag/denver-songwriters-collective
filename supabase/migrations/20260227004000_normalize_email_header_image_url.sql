-- Normalize global email header image URL to a stable first-party asset.
-- This prevents brittle signed URLs from leaking into outgoing email HTML.

update public.site_settings
set
  email_header_image_url = 'https://coloradosongwriterscollective.org/images/CSCEmailHeader1.png',
  updated_at = now()
where id = 'global'
  and (
    email_header_image_url is null
    or btrim(email_header_image_url) = ''
    or email_header_image_url like '%/storage/v1/object/sign/%Header1.png%'
    or email_header_image_url like '%/storage/v1/object/public/email-images/%Header1.png%'
  );
