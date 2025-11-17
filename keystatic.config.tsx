import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    posts: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        publishedDate: fields.date({
          label: 'Published Date',
          defaultValue: { kind: 'today' },
        }),
        author: fields.text({
          label: 'Author',
          defaultValue: 'Chess Moments Team',
        }),
        excerpt: fields.text({
          label: 'Excerpt',
          multiline: true,
        }),
        coverImage: fields.image({
          label: 'Cover Image',
          directory: 'public/images/posts',
          publicPath: '/images/posts/',
        }),
        content: fields.document({
          label: 'Content',
          formatting: true,
          dividers: true,
          links: true,
          images: true,
        }),
      },
    }),
    pages: collection({
      label: 'Pages',
      slugField: 'title',
      path: 'content/pages/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          multiline: true,
        }),
        content: fields.document({
          label: 'Content',
          formatting: true,
          dividers: true,
          links: true,
        }),
      },
    }),
  },
});
