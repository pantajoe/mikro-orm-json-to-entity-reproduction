import { Entity, Property, OneToMany, Collection, ManyToOne, Ref, MikroORM, BaseEntity as OrmBase, PrimaryKey, Opt, wrap, helper } from '@mikro-orm/sqlite'

@Entity()
abstract class BaseEntity extends OrmBase {
  @PrimaryKey({ autoincrement: true })
    id: number

  @Property({ type: 'date', onUpdate: () => new Date() })
    updatedAt: Date & Opt = new Date()

  @Property({ type: 'date', onCreate: () => new Date() })
    createdAt: Date & Opt = new Date()
}

@Entity()
class Author extends BaseEntity {
  @Property()
    name: string

  @OneToMany(() => Book, book => book.author)
    books = new Collection<Book>(this)
}

@Entity()
class Book extends BaseEntity {
  @Property()
    title: string

  @ManyToOne(() => Author, { ref: true })
    author: Ref<Author>
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [User],
    debug: ['query', 'query-params'],
    persistOnCreate: true,
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test('can "hydrate" an entity from JSON without querying the DB', async () => {
  const author = orm.em.create(Author, { name: 'Jon Snow' })
  orm.em.create(Book, { title: 'Book of the North', author })
  await orm.em.flush()
  const pojo = wrap(author).toJSON() // Serialize to JSON including the books Collection
  orm.em.clear() // Emulate new Request Context

  const entity = orm.em.create(Author, pojo, { managed: false, persist: false }) // Create Entity that can be used, but treat as if it were loaded via a findOne query without doing a trip to the DB
  expect(wrap(entity).toPOJO()).toEqual({
    id: 1,
    name: 'Jon Snow',
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
    books: [
      {
        id: 1,
        title: 'Book of the North',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        author: expect.objectContaining({ id: 1 })
      }
    ]
  })

  // Make sure that the changesert is empty
  orm.em.getUnitOfWork().computeChangeSets()
  expect(orm.em.getUnitOfWork().getChangeSets().length).toBe(0)
  await expect(orm.em.flush()).resolves.not.toThrow()
});
