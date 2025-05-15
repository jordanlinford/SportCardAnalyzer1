import { Helmet } from 'react-helmet-async';
import { DisplayCase } from '@/types/display-case';

interface DisplayCaseMetaTagsProps {
  displayCase: DisplayCase;
  firstCardImage?: string;
}

export function DisplayCaseMetaTags({ displayCase, firstCardImage }: DisplayCaseMetaTagsProps) {
  const title = `${displayCase.name} | Sports Card Display Case`;
  const description = displayCase.description || `Check out this sports card display case featuring ${displayCase.cardIds?.length || 0} cards`;
  const imageUrl = firstCardImage || '/images/default-display-case.jpg';
  const url = `${window.location.origin}/display/${displayCase.publicId}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
} 