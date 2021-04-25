FROM ekidd/rust-musl-builder AS cargo-audit-build

RUN cargo install cargo cargo-audit --root /home/rust && \
    strip /home/rust/bin/cargo /home/rust/bin/cargo-audit

FROM alpine:3.12

ENV FINDSECBUGS_VERSION=1.10.1
ENV OWASP_VERSION=5.3.0

ARG FINDSECBUGS_FOLDER=/usr/local/opt/findsecbugs
ARG OWASP_DEP_FOLDER=/usr/local/bin/owaspdependency

RUN apk update  && \
    apk add --no-cache bash && \
    bash --login
RUN apk add --no-cache \
            ca-certificates \
            nodejs \
            npm \
            yarn \
            openjdk8 \
            maven \
            python3 \
            py3-pip \
            perl \
            git \
            php7 \
            php7-cli \
            curl \
            ruby

RUN pip install safety==1.9.0 piprot==0.9.11 bandit==1.6.2

RUN { \
        echo 'install: --no-document'; \
        echo 'update: --no-document'; \
    } >> /etc/gemrc && \
    gem install bundler:2.0.1 bundler-audit:0.6.1 brakeman:4.5.1 && \
    bundle audit update

RUN mkdir -p ${FINDSECBUGS_FOLDER} && cd ${FINDSECBUGS_FOLDER} && \
    wget --quiet https://github.com/find-sec-bugs/find-sec-bugs/releases/download/version-${FINDSECBUGS_VERSION}/findsecbugs-cli-${FINDSECBUGS_VERSION}.zip && \
    unzip findsecbugs-cli-${FINDSECBUGS_VERSION}.zip && \
    rm findsecbugs-cli-${FINDSECBUGS_VERSION}.zip && \
    chmod +x ${FINDSECBUGS_FOLDER}/findsecbugs.sh && \
    ln -s ${FINDSECBUGS_FOLDER}/findsecbugs.sh /usr/local/bin/findsecbugs

RUN mkdir $OWASP_DEP_FOLDER && cd $OWASP_DEP_FOLDER && \
    wget --quiet http://dl.bintray.com/jeremy-long/owasp/dependency-check-${OWASP_VERSION}-release.zip && \
    unzip -q dependency-check-${OWASP_VERSION}-release.zip && \
    chmod +x $OWASP_DEP_FOLDER/dependency-check/bin/dependency-check.sh && \
    rm dependency-check-${OWASP_VERSION}-release.zip && \
    mv dependency-check/bin/dependency-check.sh dependency-check/bin/dependency-check && \
    $OWASP_DEP_FOLDER/dependency-check/bin/dependency-check --updateonly
ENV PATH $OWASP_DEP_FOLDER/dependency-check/bin:$PATH

RUN cd /usr/local/bin && \
    wget --quiet https://www.laravel-enlightn.com/security-checker.phar && \
    chmod +x security-checker.phar

COPY --from=cargo-audit-build /home/rust/bin/ /usr/local/bin/

WORKDIR /hawkeye
COPY . .
RUN npm install --production --quiet && \
    rm -rf /var/cache/apk/*

WORKDIR /target
ENV PATH /hawkeye/bin:$PATH

ENTRYPOINT ["hawkeye", "scan"]
