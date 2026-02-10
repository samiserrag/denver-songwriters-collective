-- Scope admin-only policies away from role public to prevent anon evaluation
-- of is_admin() in SELECT policy planning.

alter policy blog_posts_admin_all
on public.blog_posts
to authenticated;

alter policy gallery_albums_admin_all
on public.gallery_albums
to authenticated;

alter policy gallery_images_admin
on public.gallery_images
to authenticated;
