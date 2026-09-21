import React from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: 'website' | 'article';
  image?: string;
}

const BASE_URL = 'https://taskiye.vercel.app';

/**
 * Route-level SEO component leveraging React 19 native head element hoisting.
 * React 19 automatically hoists `<title>`, `<meta>`, and `<link>` tags into the document `<head>`.
 */
export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonicalPath = '/',
  ogType = 'website',
  image = '/og-image.png',
}) => {
  const fullCanonical = `${BASE_URL}${canonicalPath === '/' ? '' : canonicalPath}`;
  const fullImage = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  return (
    <>
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <link rel="canonical" href={fullCanonical} />

      {/* Open Graph Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={fullImage} />

      {/* Twitter Cards */}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
    </>
  );
};
