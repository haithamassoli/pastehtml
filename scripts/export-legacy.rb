# frozen_string_literal: true
#
# TEMPLATE — this file does not run against your Rails app as written.
#
# There is no Rails source in this repository, so every model name, column name
# and association below is a GUESS. Read each `# ASSUMPTION:` marker, change the
# line under it to match your real schema, and delete the marker once you have.
# `docs/migration.md` has the checklist; the format this must produce is
# specified there too, and `test/fixtures/legacy.ts` is a worked example of it.
#
# Run it inside the legacy app:
#
#   bin/rails runner scripts/export-legacy.rb ./export
#
# It writes four files into that directory:
#
#   manifest.json    counts and provenance
#   owners.json      legacy user id -> Clerk tokenIdentifier  (YOU fill this in)
#   folders.jsonl    one folder per line
#   pastes.jsonl     one paste per line, HTML inline as base64
#
# The output contains raw update tokens and, if your app stored them
# recoverably, raw passwords. Treat the directory as a secret: encrypt it in
# transit and delete it once the migration has been validated.

require "json"
require "base64"
require "digest"
require "fileutils"

DIR = ARGV[0] || "./export"
FileUtils.mkdir_p(DIR)

# Milliseconds since the epoch. The importer refuses anything before the year
# 2000, which is what catches this being left in seconds.
def ms(time)
  (time.to_f * 1000).round
end

# ASSUMPTION: your models are `Paste`, `Folder` and `User`.
pastes = Paste.all
folders = Folder.all
users = User.all

# --- owners.json -------------------------------------------------------------
# Ownership cannot be derived: the new app keys every row on a Clerk
# `tokenIdentifier` (`"<issuer>|<subject>"`), which has no relationship to a
# legacy user id. This writes the left-hand side and the email to match on; you
# fill in the right-hand side after importing these users into Clerk, then
# rename the file to `owners.json`.
#
# Any paste whose owner is missing from `owners.json` imports as anonymous — its
# URL keeps working, but it will not appear in anyone's dashboard until the
# mapping is filled in and the import re-run.
owners_template = users.each_with_object({}) do |user, acc|
  # ASSUMPTION: `users.email`. Replace the value with the Clerk tokenIdentifier.
  acc[user.id.to_s] = "TODO clerk tokenIdentifier for #{user.email}"
end
File.write(
  File.join(DIR, "owners.template.json"),
  JSON.pretty_generate(owners_template)
)

# --- folders.jsonl -----------------------------------------------------------
# The new schema has no folder id of its own to preserve and no nesting: a
# folder is `(ownerId, name)`. If your folders nest, flatten them here — e.g.
# "Parent / Child" — because the importer will otherwise drop the hierarchy
# silently and you will find out during validation.
File.open(File.join(DIR, "folders.jsonl"), "w") do |file|
  folders.find_each do |folder|
    file.puts JSON.generate(
      legacyId: folder.id.to_s,
      # ASSUMPTION: `folders.user_id`.
      legacyOwnerId: folder.user_id.to_s,
      name: folder.name,
      createdAt: ms(folder.created_at),
      updatedAt: ms(folder.updated_at)
    )
  end
end

# --- pastes.jsonl ------------------------------------------------------------
File.open(File.join(DIR, "pastes.jsonl"), "w") do |file|
  pastes.find_each do |paste|
    # ASSUMPTION: the HTML is a column on the row. If yours lives on disk or in
    # S3, read the bytes here instead — and read them as binary, because the
    # migration validates a byte-for-byte match and an encoding conversion on
    # the way out is the one corruption that survives every later check.
    html = paste.content.to_s.dup.force_encoding(Encoding::BINARY)

    # ASSUMPTION: `pastes.token` is the public token, and it is already a
    # lowercase DNS label. The importer rejects anything else, because the
    # wildcard host lowercases before it looks a token up: a token with an
    # uppercase letter would be unreachable at its own URL. If your tokens are
    # mixed case (`SecureRandom.urlsafe_base64` is), stop here and decide what
    # to do about it — see "Records that cannot be migrated" in
    # `docs/migration.md`.
    record = {
      legacyId: paste.id.to_s,
      token: paste.token,
      # ASSUMPTION: `pastes.user_id`, nil for anonymous pastes.
      legacyOwnerId: paste.user_id&.to_s,
      # ASSUMPTION: `pastes.folder_id`.
      legacyFolderId: paste.folder_id&.to_s,
      # ASSUMPTION: a filename column. The new app needs one for
      # Content-Disposition; "index.html" is a reasonable default if you have
      # nothing to migrate.
      filename: paste.filename.presence || "index.html",
      title: paste.title.presence,
      description: paste.description.presence,
      # ASSUMPTION: `pastes.subdomain`. Must be a free, non-reserved DNS label
      # of 3-63 characters or the record fails and you decide what to do.
      customSubdomain: paste.subdomain.presence,
      # ASSUMPTION: everything was served as HTML.
      contentType: "text/html; charset=utf-8",
      contentBase64: Base64.strict_encode64(html),
      sha256: Digest::SHA256.hexdigest(html),
      # ASSUMPTION: a password digest column marks a protected paste. The digest
      # itself does NOT come across — see the password policy in docs/migration.md.
      visibility: paste.password_digest.present? ? "protected" : "public",
      # DO NOT set `password` from a bcrypt digest — it is the plaintext or
      # nothing. Uncomment only if your app genuinely stored a recoverable
      # value, and understand that it will be written to this file in the clear:
      # password: paste.password_plaintext,
      #
      # ASSUMPTION: the anonymous edit code was stored recoverably. If it was
      # hashed, leave this out: the paste imports without a management
      # credential and its author can no longer edit it.
      updateToken: paste.user_id ? nil : paste.edit_token,
      # ASSUMPTION: `pastes.views_count`. Per-view analytics rows are NOT
      # migrated — only this running total.
      viewsCount: paste.views_count.to_i,
      createdAt: ms(paste.created_at),
      updatedAt: ms(paste.updated_at)
    }

    # `nil` and JSON `null` are not the same as absent to the importer: an
    # optional field must be missing, not null.
    file.puts JSON.generate(record.compact)
  end
end

# --- manifest.json -----------------------------------------------------------
File.write(
  File.join(DIR, "manifest.json"),
  JSON.pretty_generate(
    format: "pastehtml-migration/1",
    exportedAt: ms(Time.now),
    source: "rails://#{Rails.env}",
    counts: {
      folders: folders.count,
      pastes: pastes.count,
      users: users.count
    }
  )
)

warn "wrote #{pastes.count} pastes and #{folders.count} folders to #{DIR}"
warn "next: fill in owners.template.json and rename it to owners.json"
