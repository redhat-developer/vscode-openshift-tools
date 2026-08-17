# Creating an application with a Node.js code sample

**Note:** The Node.js code sample uses the **3001** HTTP port.

Before you begin creating an application with this `devfile` code sample, it's helpful to understand the relationship between the `devfile` and `Dockerfile` and how they contribute to your build. You can find these files at the following URLs:

* [Node.js `devfile.yaml`](https://github.com/nodeshift-starters/devfile-sample/blob/main/devfile.yaml)
* [Node.js `Dockerfile`](https://github.com/nodeshift-starters/devfile-sample/blob/main/Dockerfile)

1. The `devfile.yaml` file has an [`image-build` component](https://github.com/nodeshift-starters/devfile-sample/blob/main/devfile.yaml#L18-L24) that points to your `Dockerfile`.
2. The [`Dockerfile`](https://github.com/nodeshift-starters/devfile-sample/blob/main/Dockerfile) contains the instructions you need to build the code sample as a container image.
3. The `devfile.yaml` [`kubernetes-deploy` component](https://github.com/nodeshift-starters/devfile-sample/blob/main/devfile.yaml#L25-L37) points to a `deploy.yaml` file that contains instructions for deploying the built container image.
4. The `devfile.yaml` [`deploy` command](https://github.com/nodeshift-starters/devfile-sample/blob/main/devfile.yaml#L45-L52) completes the [outerloop](https://devfile.io/docs/2.2.0/innerloop-vs-outerloop) deployment phase by pointing to the `image-build` and `kubernetes-deploy` components to create your application.

## License

This stack is licensed under the [EPL 2.0](./LICENSE) license.

### Additional resources
* For more information about Node.js, see [How do I start with Node.js after I installed it?](https://nodejs.org/en/docs/guides/getting-started-guide).
* For more information about devfiles, see [Devfile.io](https://devfile.io/).
* For more information about Dockerfiles, see [Dockerfile reference](https://docs.docker.com/engine/reference/builder/).