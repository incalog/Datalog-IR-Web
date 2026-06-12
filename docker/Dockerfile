# Build docker-image for intel on mX macs: docker build --platform linux/amd64 -t inca-web .
FROM node:24-bookworm-slim AS frontend-build

WORKDIR /workspace/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build -- --configuration production

FROM sbtscala/scala-sbt:eclipse-temurin-focal-17.0.9_9_1.9.8_3.3.1

SHELL ["/bin/bash", "-c"]

RUN apt-get clean
RUN rm -rf /var/lib/apt/lists/*

# Install Souffle
RUN wget https://souffle-lang.github.io/ppa/souffle-key.public -O /usr/share/keyrings/souffle-archive-keyring.gpg && \
	echo "deb [signed-by=/usr/share/keyrings/souffle-archive-keyring.gpg] https://souffle-lang.github.io/ppa/ubuntu/ stable main" | tee /etc/apt/sources.list.d/souffle.list && \
	apt-get update -y && \
	apt-get install -y souffle && \
    rm -rf /var/lib/apt/lists/*
    
# Install Rust for Ascent and DDLog
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup component add rustfmt clippy

# Install z3
#RUN apt-get update && apt-get install -y z3

# Update sbt
RUN sbt sbtVersion && \
 	sbt update
 	

# Install DDLog
ARG DDLOG_REPOSITORY=https://github.com/Schlaubischlump/DDlog.git
ARG DDLOG_REF=master
ENV DDLOG_HOME=/opt/ddlog
ENV CLASSPATH="${DDLOG_HOME}/flatbuffers/java"
ENV PATH="${DDLOG_HOME}/flatbuffers:${PATH}"

RUN apt-get update -y && \
	apt-get install -y --no-install-recommends \
	autoconf \
	build-essential \
	cmake \
	git \
	gnupg \
	libc6-dev \
	libffi-dev \
	libgmp-dev \
	libncurses-dev \
	libssl-dev \
	libtinfo-dev \
	libtool \
	make \
	maven \
	pkg-config \
	subversion \
	unzip \
	zlib1g-dev && \
	rm -rf /var/lib/apt/lists/*

RUN wget -qO- https://get.haskellstack.org/ | sh

RUN git clone "${DDLOG_REPOSITORY}" "${DDLOG_HOME}" && \
	cd "${DDLOG_HOME}" && \
	git checkout "${DDLOG_REF}" && \
	./tools/install-flatbuf.sh && \
	stack --install-ghc build && \
	stack install --local-bin-path /usr/local/bin && \
	ddlog --version

# Install and publish INCA Maven dependencies locally
ARG TRUEDIFF_REPOSITORY=https://gitlab.rlp.net/plmz/truediff.git
ARG TRUEDIFF_REF=master
ARG STURDY_REPOSITORY=https://gitlab.rlp.net/plmz/sturdy.scala.git
ARG STURDY_REF=master
ARG BENCHMARK_REPOSITORY=https://gitlab.rlp.net/plmz/benchmark-scala.git
ARG BENCHMARK_REF=main
ENV TRUEDIFF_HOME=/opt/truediff
ENV STURDY_HOME=/opt/sturdy.scala
ENV BENCHMARK_HOME=/opt/benchmark-scala

RUN git clone "${TRUEDIFF_REPOSITORY}" "${TRUEDIFF_HOME}" && \
	cd "${TRUEDIFF_HOME}" && \
	git checkout "${TRUEDIFF_REF}" && \
	sbt -Dsbt.log.noformat=true publishM2

RUN git clone "${STURDY_REPOSITORY}" "${STURDY_HOME}" && \
	cd "${STURDY_HOME}" && \
	git checkout "${STURDY_REF}" && \
	sbt -Dsbt.log.noformat=true 'set ThisBuild / version := "0.1-SNAPSHOT"' sturdy_core/publishM2

RUN git clone "${BENCHMARK_REPOSITORY}" "${BENCHMARK_HOME}" && \
	cd "${BENCHMARK_HOME}" && \
	git checkout "${BENCHMARK_REF}" && \
	GITLAB_DEPLOY_TOKEN_USERNAME=docker GITLAB_DEPLOY_TOKEN_PASSWORD=docker \
	sbt -Dsbt.log.noformat=true 'set skip / publish := false' publishM2

# Install and publish INCA locally for Maven consumers
ARG INCA_REPOSITORY=https://github.com/incalog/Datalog-IR.git
ARG INCA_REF=abstract-interpretation
ENV INCA_HOME=/opt/inca

RUN git clone "${INCA_REPOSITORY}" "${INCA_HOME}" && \
	cd "${INCA_HOME}" && \
	git checkout "${INCA_REF}" && \
	sbt -Dsbt.log.noformat=true publishM2

# Build the Spring Boot app with the Angular frontend served as static content
WORKDIR /workspace

COPY pom.xml ./
COPY src ./src
COPY --from=frontend-build /workspace/frontend/dist/inca-web-frontend/browser/ ./src/main/resources/static/

RUN mvn -B -DskipTests package

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/workspace/target/inca-web-1.0-SNAPSHOT.jar"]
