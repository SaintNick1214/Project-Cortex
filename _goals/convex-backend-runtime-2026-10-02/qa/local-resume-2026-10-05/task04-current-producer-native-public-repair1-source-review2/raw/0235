FROM --platform=linux/amd64 node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS node
FROM --platform=linux/amd64 python:3.12.15-slim-bookworm@sha256:2ed6491b93cd49272ee6de2b5a38440c3448360322c089fc23e370722d74179d
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY bootstrap-npm.py /opt/cortex-c8-bootstrap-npm.py
RUN /usr/local/bin/python3.12 /opt/cortex-c8-bootstrap-npm.py
ENV PYTHONDONTWRITEBYTECODE=1 PATH=/usr/local/bin:/usr/bin:/bin HOME=/phase/home TMPDIR=/tmp
WORKDIR /phase
CMD ["/usr/local/bin/python3.12", "--version"]
