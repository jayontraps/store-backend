module.exports = ({ env }) => ({
  email: {
    provider: "sendgrid",
    providerOptions: {
      apiKey: env("SENDGRID_API_KEY"),
    },
    settings: {
      defaultFrom: env("SENDGRID_DEFAULT_FROM"),
      defaultReplyTo: env("SENDGRID_DEFAULT_REPLY_TO"),
    },
  },
  upload: {
    provider: "aws-s3",
    providerOptions: {
      accessKeyId: env("AWS_ACCESS_KEY_ID"),
      secretAccessKey: env("AWS_ACCESS_SECRET"),
      region: "eu-west-2",
      params: {
        Bucket: "plycoasters",
      },
    },
  },
});
