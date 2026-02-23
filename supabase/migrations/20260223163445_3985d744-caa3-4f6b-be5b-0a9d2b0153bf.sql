
-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false);

-- Allow anyone to upload to pdfs bucket (vault is PIN-protected at app level)
CREATE POLICY "Allow authenticated and anon upload to pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pdfs');

-- Allow anyone to read from pdfs bucket
CREATE POLICY "Allow read from pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdfs');

-- Allow anyone to delete from pdfs bucket
CREATE POLICY "Allow delete from pdfs"
ON storage.objects FOR DELETE
USING (bucket_id = 'pdfs');
